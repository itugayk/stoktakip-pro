"use client";

import { demoProducts } from "@/lib/demo-data";
import type { ProductWithStock } from "@/lib/types";

const DEMO_PRODUCTS_STORAGE_KEY = "stoktakip-demo-products";

export function isClientDemoMode() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !supabaseUrl || supabaseUrl.includes("placeholder");
}

export function getStoredDemoProducts(): ProductWithStock[] {
  if (typeof window === "undefined" || !isClientDemoMode()) return [];

  try {
    const raw = window.localStorage.getItem(DEMO_PRODUCTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredDemoProduct(product: ProductWithStock) {
  if (typeof window === "undefined" || !isClientDemoMode()) return;

  const stored = getStoredDemoProducts();
  const next = [
    product,
    ...stored.filter((item) => item.id !== product.id && item.barcode !== product.barcode),
  ];

  window.localStorage.setItem(DEMO_PRODUCTS_STORAGE_KEY, JSON.stringify(next));
}

export function mergeStoredDemoProducts(products: ProductWithStock[] = demoProducts) {
  const stored = getStoredDemoProducts();
  const storedKeys = new Set(stored.flatMap((product) => [product.id, product.barcode].filter(Boolean)));

  return [
    ...stored,
    ...products.filter((product) => !storedKeys.has(product.id) && !storedKeys.has(product.barcode)),
  ];
}
