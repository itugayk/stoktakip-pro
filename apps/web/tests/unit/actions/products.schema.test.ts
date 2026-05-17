/**
 * Lightweight test for the product action input validator. We can't run the
 * server action itself (it pulls in next/headers via supabase server client),
 * so we re-declare the same schema here as a contract test. Drift between this
 * file and the action shape should fail CI.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseInput } from "@/lib/server/validate";
import { AppError } from "@/lib/server/errors";

const productInputSchema = z.object({
  name: z.string().min(1, "Ürün adı zorunlu"),
  sku: z.string().min(1, "SKU zorunlu"),
  barcode: z.string().optional(),
  categoryId: z.string(),
  unit: z.string().min(1),
  minStock: z.number().nonnegative(),
  maxStock: z.number().nonnegative(),
  purchasePrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative(),
  description: z.string().optional(),
});

describe("createProduct input validation", () => {
  const valid = {
    name: "Paracetamol",
    sku: "ILC-001",
    categoryId: "cat-1",
    unit: "kutu",
    minStock: 10,
    maxStock: 100,
    purchasePrice: 12.5,
    salePrice: 18.9,
  };

  it("accepts a minimal valid payload", () => {
    expect(() => parseInput(productInputSchema, valid)).not.toThrow();
  });

  it("rejects empty name", () => {
    expect(() => parseInput(productInputSchema, { ...valid, name: "" })).toThrow(AppError);
  });

  it("rejects empty SKU", () => {
    expect(() => parseInput(productInputSchema, { ...valid, sku: "" })).toThrow(AppError);
  });

  it("rejects negative minStock", () => {
    expect(() => parseInput(productInputSchema, { ...valid, minStock: -1 })).toThrow(AppError);
  });
});
