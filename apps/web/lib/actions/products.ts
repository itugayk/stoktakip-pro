"use server";

import { demoProducts, demoCategories } from "@/lib/demo-data";
import type { ProductWithStock, Category } from "@/lib/types";
import {
  toProductWithStock,
  fromProduct,
  toCategory,
  fromCategory,
} from "@/lib/mappers";
import {
  withAuth,
  withCompany,
  ok,
  parseInput,
  z,
  ERR,
  logAudit,
} from "@/lib/server";
import { fireWebhookEvent } from "@/lib/webhooks/dispatch";

// ============================================
// GET PRODUCTS (with stock summary)
// ============================================
export const getProducts = withAuth<
  { search?: string; categoryId?: string; status?: string } | undefined,
  ProductWithStock[]
>(async (ctx, filters) => {
  if (ctx.demo) {
    let results = [...demoProducts];
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.includes(q)
      );
    }
    if (filters?.categoryId && filters.categoryId !== "all") {
      results = results.filter((p) => p.categoryId === filters.categoryId);
    }
    if (filters?.status && filters.status !== "all") {
      results = results.filter((p) => p.stockStatus === filters.status);
    }
    return ok(results);
  }

  let query = ctx.supabase
    .from("product_stock_summary")
    .select("*")
    .order("name");

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%`);
  }
  if (filters?.categoryId && filters.categoryId !== "all") {
    query = query.eq("category_id", filters.categoryId);
  }
  if (filters?.status && filters.status !== "all") {
    query = query.eq("stock_status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw ERR.database(error.message);

  return ok((data ?? []).map(toProductWithStock));
});

// ============================================
// CREATE PRODUCT
// ============================================
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

export const createProduct = withCompany<z.input<typeof productInputSchema>, void>(
  async (ctx, raw) => {
    const data = parseInput(productInputSchema, raw);
    if (ctx.demo) return ok();

    const insert = fromProduct({ ...data, companyId: ctx.companyId });
    const { data: row, error } = await ctx.supabase
      .from("products")
      .insert(insert as never)
      .select("id")
      .single();
    if (error) throw ERR.database(error.message);
    await logAudit(ctx, {
      action: "create",
      table: "products",
      recordId: row.id,
      newData: data as unknown as Record<string, unknown>,
    });
    void fireWebhookEvent(ctx.companyId, "product.created", {
      productId: row.id,
      ...data,
    });
    return ok();
  }
);

// ============================================
// UPDATE PRODUCT
// ============================================
const productUpdateSchema = z.object({
  id: z.string(),
  patch: z
    .object({
      name: z.string().optional(),
      sku: z.string().optional(),
      barcode: z.string().optional(),
      categoryId: z.string().optional(),
      unit: z.string().optional(),
      minStock: z.number().optional(),
      maxStock: z.number().optional(),
      purchasePrice: z.number().optional(),
      salePrice: z.number().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "Güncellenecek alan yok" }),
});

export const updateProduct = withCompany<z.input<typeof productUpdateSchema>, void>(
  async (ctx, raw) => {
    const { id, patch } = parseInput(productUpdateSchema, raw);
    if (ctx.demo) return ok();

    const { data: before } = await ctx.supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const update = fromProduct(patch);
    const { error } = await ctx.supabase.from("products").update(update).eq("id", id);
    if (error) throw ERR.database(error.message);

    await logAudit(ctx, {
      action: "update",
      table: "products",
      recordId: id,
      oldData: (before as Record<string, unknown>) ?? undefined,
      newData: update as Record<string, unknown>,
    });
    void fireWebhookEvent(ctx.companyId, "product.updated", { productId: id, changes: patch });
    return ok();
  }
);

// ============================================
// DELETE PRODUCT
// ============================================
export const deleteProduct = withCompany<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { data: before } = await ctx.supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const { error } = await ctx.supabase.from("products").delete().eq("id", id);
  if (error) throw ERR.database(error.message);
  await logAudit(ctx, {
    action: "delete",
    table: "products",
    recordId: id,
    oldData: (before as Record<string, unknown>) ?? undefined,
  });
  void fireWebhookEvent(ctx.companyId, "product.deleted", { productId: id });
  return ok();
});

// ============================================
// GET CATEGORIES
// ============================================
export const getCategories = withAuth<void, Category[]>(async (ctx) => {
  if (ctx.demo) return ok(demoCategories);

  const { data, error } = await ctx.supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw ERR.database(error.message);
  return ok((data ?? []).map(toCategory));
});

// ============================================
// CREATE CATEGORY
// ============================================
const categoryInputSchema = z.object({
  name: z.string().min(1, "Kategori adı zorunlu"),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const createCategory = withCompany<
  z.input<typeof categoryInputSchema>,
  { id: string }
>(async (ctx, raw) => {
  const data = parseInput(categoryInputSchema, raw);
  if (ctx.demo) return ok({ id: `cat-${Date.now()}` });

  const insert = fromCategory({ ...data, companyId: ctx.companyId });
  const { data: result, error } = await ctx.supabase
    .from("categories")
    .insert(insert as never)
    .select("id")
    .single();

  if (error) throw ERR.database(error.message);
  return ok({ id: result.id });
});

// ============================================
// UPDATE CATEGORY
// ============================================
const categoryUpdateSchema = z.object({
  id: z.string(),
  patch: z
    .object({
      name: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "Güncellenecek alan yok" }),
});

export const updateCategory = withCompany<z.input<typeof categoryUpdateSchema>, void>(
  async (ctx, raw) => {
    const { id, patch } = parseInput(categoryUpdateSchema, raw);
    if (ctx.demo) return ok();

    const update = fromCategory(patch);
    const { error } = await ctx.supabase.from("categories").update(update).eq("id", id);
    if (error) throw ERR.database(error.message);
    return ok();
  }
);

// ============================================
// DELETE CATEGORY (soft-delete: is_active = false)
// ============================================
export const deleteCategory = withCompany<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase
    .from("categories")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});

// ============================================
// BULK OPERATIONS (1.5)
// ============================================
const bulkIdsSchema = z.object({
  ids: z.array(z.string()).min(1, "En az bir ürün seçin"),
});

const bulkPatchSchema = z.object({
  ids: z.array(z.string()).min(1, "En az bir ürün seçin"),
  patch: z
    .object({
      categoryId: z.string().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "Boş güncelleme" }),
});

const bulkPriceSchema = z.object({
  ids: z.array(z.string()).min(1, "En az bir ürün seçin"),
  op: z.object({
    type: z.enum(["percent", "fixed"]),
    /** + raise, - reduce. For percent: 10 = +10%, -5 = -5%. */
    value: z.number(),
    /** Which price field to mutate. Defaults to sale price. */
    field: z.enum(["sale_price", "purchase_price"]).optional(),
  }),
});

export const bulkUpdateProducts = withCompany<
  z.input<typeof bulkPatchSchema>,
  { updated: number }
>(async (ctx, raw) => {
  const { ids, patch } = parseInput(bulkPatchSchema, raw);
  if (ctx.demo) return ok({ updated: ids.length });

  const update = fromProduct(patch);
  const { data, error } = await ctx.supabase
    .from("products")
    .update(update)
    .in("id", ids)
    .select("id");

  if (error) throw ERR.database(error.message);
  return ok({ updated: data?.length ?? 0 });
});

export const bulkDeleteProducts = withCompany<
  z.input<typeof bulkIdsSchema>,
  { deleted: number }
>(async (ctx, raw) => {
  const { ids } = parseInput(bulkIdsSchema, raw);
  if (ctx.demo) return ok({ deleted: ids.length });

  const { data, error } = await ctx.supabase
    .from("products")
    .delete()
    .in("id", ids)
    .select("id");

  if (error) throw ERR.database(error.message);
  return ok({ deleted: data?.length ?? 0 });
});

export const bulkPriceUpdate = withCompany<
  z.input<typeof bulkPriceSchema>,
  { updated: number }
>(async (ctx, raw) => {
  const { ids, op } = parseInput(bulkPriceSchema, raw);
  if (ctx.demo) return ok({ updated: ids.length });

  const field = op.field ?? "sale_price";

  // We need each row's current price to apply percent or fixed delta safely.
  const { data: current, error: readErr } = await ctx.supabase
    .from("products")
    .select(`id, ${field}`)
    .in("id", ids);

  if (readErr) throw ERR.database(readErr.message);

  let updated = 0;
  for (const row of current ?? []) {
    const r = row as unknown as Record<string, number>;
    const base = Number(r[field] ?? 0);
    const next = op.type === "percent" ? base * (1 + op.value / 100) : base + op.value;
    const rounded = Math.max(0, Math.round(next * 100) / 100);
    const { error } = await ctx.supabase
      .from("products")
      .update({ [field]: rounded })
      .eq("id", r.id);
    if (!error) updated++;
  }
  return ok({ updated });
});

// ============================================
// LOOKUP PRODUCT BY BARCODE
// ============================================
export interface BarcodeLookupResult {
  found: boolean;
  product?: { name: string; sku: string; currentStock: number; unit: string };
}

export const lookupBarcode = withAuth<string, BarcodeLookupResult>(
  async (ctx, code) => {
    if (ctx.demo) {
      const product = demoProducts.find(
        (p) => p.barcode === code || p.sku === code.toUpperCase()
      );
      if (!product) return ok({ found: false });
      return ok({
        found: true,
        product: {
          name: product.name,
          sku: product.sku,
          currentStock: product.currentStock,
          unit: product.unit,
        },
      });
    }

    const { data } = await ctx.supabase
      .from("product_stock_summary")
      .select("name, sku, current_stock, unit")
      .or(`barcode.eq.${code},sku.ilike.${code}`)
      .limit(1)
      .single();

    if (!data) return ok({ found: false });
    return ok({
      found: true,
      product: {
        name: data.name,
        sku: data.sku,
        currentStock: data.current_stock,
        unit: data.unit,
      },
    });
  }
);

