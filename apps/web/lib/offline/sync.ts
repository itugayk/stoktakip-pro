"use client";

import { createStockMovement } from "@/lib/actions";
import {
  listPending,
  markFailure,
  markConflict,
  removePending,
  type PendingAction,
} from "./queue";

const MAX_ATTEMPTS = 5;

/**
 * Server error codes that mean "retrying will never succeed" — a human has to
 * resolve them. The classic case: two people sold the last unit offline; the
 * first replay wins, the second is a stock conflict.
 */
const CONFLICT_CODES = new Set(["insufficient_stock", "validation", "not_found"]);

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; conflict: boolean };

/**
 * Replay one queued action against the corresponding server action. Returns
 * `ok: true` only if the server action confirmed success. The item's `id` is
 * passed as `clientActionId` so the server applies it at most once.
 */
async function dispatch(item: PendingAction): Promise<ActionResult> {
  try {
    switch (item.action) {
      case "stock_in":
      case "stock_out":
      case "transfer":
      case "adjustment": {
        const res = await createStockMovement({
          ...(item.payload as Parameters<typeof createStockMovement>[0]),
          clientActionId: item.id,
        });
        if (res.ok) return { ok: true };
        return {
          ok: false,
          error: res.error.message,
          conflict: CONFLICT_CODES.has(res.error.code),
        };
      }
      case "count":
        // Counting flow has its own action (see Phase 3.3); skip for now.
        return { ok: false, error: "count replay not implemented", conflict: false };
      default:
        return {
          ok: false,
          error: `unknown action: ${item.action as string}`,
          conflict: true,
        };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "unexpected",
      conflict: false,
    };
  }
}

export interface SyncReport {
  attempted: number;
  succeeded: number;
  failed: number;
  conflicts: number;
}

/**
 * Replay all queued actions. Drops items that succeed or exceed MAX_ATTEMPTS.
 * Safe to call concurrently — guarded by a module-level promise.
 */
let inFlight: Promise<SyncReport> | null = null;

export function syncQueue(): Promise<SyncReport> {
  if (inFlight) return inFlight;
  inFlight = doSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSync(): Promise<SyncReport> {
  const items = await listPending();
  let succeeded = 0;
  let failed = 0;
  let conflicts = 0;
  for (const item of items) {
    // Already-flagged conflicts wait for the user; don't auto-retry them.
    if (item.conflict) {
      conflicts++;
      continue;
    }
    const result = await dispatch(item);
    if (result.ok) {
      await removePending(item.id);
      succeeded++;
    } else if (result.conflict) {
      // Business conflict (e.g. stock sold out underneath us). Never silently
      // drop — flag it so the user can decide what to do.
      await markConflict(item.id, result.error);
      conflicts++;
    } else if (item.attempts + 1 >= MAX_ATTEMPTS) {
      // Transient errors that won't clear: keep them as a conflict for review
      // instead of deleting (the old behaviour silently lost data).
      await markConflict(item.id, `${MAX_ATTEMPTS} denemede gönderilemedi: ${result.error}`);
      conflicts++;
    } else {
      await markFailure(item.id, result.error);
      failed++;
    }
  }
  return { attempted: items.length, succeeded, failed, conflicts };
}

/**
 * Hook this into the page (e.g. layout) to auto-sync when connectivity returns.
 */
export function startAutoSync(): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    if (navigator.onLine) void syncQueue();
  };
  window.addEventListener("online", handler);
  // Also try once on mount in case we came back online before the listener attached.
  if (navigator.onLine) void syncQueue();
  return () => window.removeEventListener("online", handler);
}
