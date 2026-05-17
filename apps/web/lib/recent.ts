"use client";

/**
 * Tracks recently-used products in localStorage. Offline-safe, capped at 10.
 * Triggered from product list rows, barcode scans, and the command palette
 * "Recent" group consumes this.
 */
const KEY = "stoktakip-recent-products";
const LIMIT = 10;

export interface RecentProduct {
  id: string;
  name: string;
  sku: string;
  /** Unix ms — used for sorting and stale eviction. */
  at: number;
}

export function getRecentProducts(): RecentProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as RecentProduct[]).slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

export function pushRecentProduct(p: { id: string; name: string; sku: string }) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const current = getRecentProducts().filter((r) => r.id !== p.id);
  const next: RecentProduct[] = [{ id: p.id, name: p.name, sku: p.sku, at: now }, ...current].slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* full storage; not critical */
  }
}

export function clearRecentProducts() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
