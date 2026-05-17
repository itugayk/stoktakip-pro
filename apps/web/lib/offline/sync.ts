"use client";

import { createStockMovement } from "@/lib/actions";
import {
  listPending,
  markFailure,
  removePending,
  type PendingAction,
} from "./queue";

const MAX_ATTEMPTS = 5;

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Replay one queued action against the corresponding server action. Returns
 * `ok: true` only if the server action confirmed success.
 */
async function dispatch(item: PendingAction): Promise<ActionResult> {
  try {
    switch (item.action) {
      case "stock_in":
      case "stock_out":
      case "transfer":
      case "adjustment": {
        const res = await createStockMovement(
          item.payload as Parameters<typeof createStockMovement>[0]
        );
        return res.ok ? { ok: true } : { ok: false, error: res.error.message };
      }
      case "count":
        // Counting flow has its own action (see Phase 3.3); skip for now.
        return { ok: false, error: "count replay not implemented" };
      default:
        return { ok: false, error: `unknown action: ${item.action as string}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unexpected" };
  }
}

export interface SyncReport {
  attempted: number;
  succeeded: number;
  failed: number;
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
  for (const item of items) {
    if (item.attempts >= MAX_ATTEMPTS) {
      // Drop poison items so the queue doesn't get stuck.
      await removePending(item.id);
      failed++;
      continue;
    }
    const result = await dispatch(item);
    if (result.ok) {
      await removePending(item.id);
      succeeded++;
    } else {
      await markFailure(item.id, result.error);
      failed++;
    }
  }
  return { attempted: items.length, succeeded, failed };
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
