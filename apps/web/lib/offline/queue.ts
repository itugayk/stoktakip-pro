"use client";

import Dexie, { type Table } from "dexie";

export type PendingActionType = "stock_in" | "stock_out" | "transfer" | "count" | "adjustment";

export interface PendingAction {
  id: string; // uuid — also used as the server-side idempotency key (clientActionId)
  action: PendingActionType;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
  /**
   * Set when the server rejected the action for a business reason that retrying
   * won't fix (e.g. insufficient stock — someone else sold the item first).
   * Conflicts are NOT auto-retried and NOT silently dropped; the user must
   * resolve them.
   */
  conflict?: boolean;
  conflictReason?: string;
}

class OfflineDB extends Dexie {
  pending!: Table<PendingAction, string>;

  constructor() {
    super("stoktakip-offline");
    this.version(1).stores({
      pending: "id, action, createdAt",
    });
  }
}

let _db: OfflineDB | null = null;
function db(): OfflineDB {
  if (!_db) _db = new OfflineDB();
  return _db;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function enqueue(
  action: PendingActionType,
  payload: Record<string, unknown>
): Promise<PendingAction> {
  const entry: PendingAction = {
    id: uuid(),
    action,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  await db().pending.add(entry);
  notifyChange();
  return entry;
}

export async function listPending(): Promise<PendingAction[]> {
  return db().pending.orderBy("createdAt").toArray();
}

export async function removePending(id: string): Promise<void> {
  await db().pending.delete(id);
  notifyChange();
}

export async function markFailure(id: string, error: string): Promise<void> {
  const item = await db().pending.get(id);
  if (!item) return;
  await db().pending.put({ ...item, attempts: item.attempts + 1, lastError: error });
  notifyChange();
}

/** Flag an item as a business conflict that retrying won't resolve. */
export async function markConflict(id: string, reason: string): Promise<void> {
  const item = await db().pending.get(id);
  if (!item) return;
  await db().pending.put({ ...item, conflict: true, conflictReason: reason });
  notifyChange();
}

/** Number of unresolved conflicts in the queue. */
export async function countConflicts(): Promise<number> {
  const items = await db().pending.toArray();
  return items.filter((i) => i.conflict).length;
}

export async function clearPending(): Promise<void> {
  await db().pending.clear();
  notifyChange();
}

// ---- Change notifications ----
// A lightweight in-tab pub/sub so the offline indicator can refresh without
// polling the IndexedDB.
const CHANGE_EVENT = "stoktakip:offline-queue-change";

function notifyChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

export function onQueueChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
