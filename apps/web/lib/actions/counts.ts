"use server";

import { withCompany, ok, parseInput, z, ERR } from "@/lib/server";

export type CountStatus = "open" | "in_progress" | "review" | "closed" | "cancelled";

export interface StockCount {
  id: string;
  name: string | null;
  warehouseId: string;
  status: CountStatus;
  startedAt: string;
  closedAt?: string;
  itemCount: number;
  scannedCount: number;
}

export interface StockCountItem {
  id: string;
  countId: string;
  productId: string;
  productName: string;
  productSku: string;
  lotNumber: string | null;
  expectedQty: number;
  countedQty: number | null;
  variance: number;
  scannedAt: string | null;
}

const createSchema = z.object({
  warehouseId: z.string(),
  name: z.string().optional(),
  categoryIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const createCount = withCompany<z.input<typeof createSchema>, { countId: string; itemCount: number }>(
  async (ctx, raw) => {
    const data = parseInput(createSchema, raw);
    if (ctx.demo) {
      return ok({ countId: `count-${Date.now()}`, itemCount: 0 });
    }

    const { data: count, error } = await ctx.supabase
      .from("stock_counts")
      .insert({
        company_id: ctx.companyId,
        warehouse_id: data.warehouseId,
        name: data.name || null,
        scope: { categories: data.categoryIds ?? [] },
        notes: data.notes || null,
        started_by: ctx.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw ERR.database(error.message);

    // Seed items from current inventory rows in scope.
    let invQuery = ctx.supabase
      .from("inventory")
      .select("product_id, lot_number, quantity, products!inner(category_id)")
      .eq("warehouse_id", data.warehouseId);
    if (data.categoryIds && data.categoryIds.length > 0) {
      invQuery = invQuery.in("products.category_id", data.categoryIds);
    }
    const { data: inv } = await invQuery;

    // Aggregate by (product, lot) so the item count matches inventory rows.
    const seeds = (inv ?? []).map((row) => ({
      count_id: count.id,
      product_id: row.product_id,
      lot_number: row.lot_number ?? null,
      expected_qty: row.quantity,
    }));

    let itemCount = 0;
    if (seeds.length > 0) {
      const { error: seedErr } = await ctx.supabase
        .from("stock_count_items")
        .insert(seeds as never);
      if (!seedErr) itemCount = seeds.length;
    }

    return ok({ countId: count.id, itemCount });
  }
);

export const listCounts = withCompany<void, StockCount[]>(async (ctx) => {
  if (ctx.demo) return ok([]);

  const { data, error } = await ctx.supabase
    .from("stock_counts")
    .select("id, name, warehouse_id, status, started_at, closed_at, stock_count_items(id, scanned_at)")
    .order("started_at", { ascending: false });
  if (error) throw ERR.database(error.message);

  return ok(
    (data ?? []).map((c) => {
      const items = (c.stock_count_items as { id: string; scanned_at: string | null }[]) ?? [];
      return {
        id: c.id,
        name: c.name,
        warehouseId: c.warehouse_id,
        status: c.status as CountStatus,
        startedAt: c.started_at,
        closedAt: c.closed_at ?? undefined,
        itemCount: items.length,
        scannedCount: items.filter((i) => i.scanned_at).length,
      };
    })
  );
});

const scanSchema = z.object({
  countId: z.string(),
  productId: z.string(),
  lotNumber: z.string().optional(),
  countedQty: z.number().nonnegative(),
});

export const recordCountScan = withCompany<z.input<typeof scanSchema>, void>(async (ctx, raw) => {
  const data = parseInput(scanSchema, raw);
  if (ctx.demo) return ok();

  // Find the item row (insert if missing — could happen if the user scanned
  // something not in the original scope).
  const { data: existing } = await ctx.supabase
    .from("stock_count_items")
    .select("id")
    .eq("count_id", data.countId)
    .eq("product_id", data.productId)
    .is("lot_number", data.lotNumber ?? null)
    .maybeSingle();

  if (existing) {
    const { error } = await ctx.supabase
      .from("stock_count_items")
      .update({
        counted_qty: data.countedQty,
        scanned_by: ctx.userId,
        scanned_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw ERR.database(error.message);
  } else {
    const { error } = await ctx.supabase.from("stock_count_items").insert({
      count_id: data.countId,
      product_id: data.productId,
      lot_number: data.lotNumber ?? null,
      expected_qty: 0,
      counted_qty: data.countedQty,
      scanned_by: ctx.userId,
      scanned_at: new Date().toISOString(),
    } as never);
    if (error) throw ERR.database(error.message);
  }

  // Mark the count as in_progress if it was still open.
  await ctx.supabase
    .from("stock_counts")
    .update({ status: "in_progress" })
    .eq("id", data.countId)
    .eq("status", "open");

  return ok();
});

const closeSchema = z.object({ countId: z.string() });

export const closeCount = withCompany<z.input<typeof closeSchema>, { adjustments: number }>(
  async (ctx, raw) => {
    const data = parseInput(closeSchema, raw);
    if (ctx.demo) return ok({ adjustments: 0 });

    const { data: count } = await ctx.supabase
      .from("stock_counts")
      .select("warehouse_id, company_id")
      .eq("id", data.countId)
      .single();
    if (!count) throw ERR.notFound("Sayım");

    const { data: items } = await ctx.supabase
      .from("stock_count_items")
      .select("product_id, lot_number, variance, counted_qty")
      .eq("count_id", data.countId)
      .not("counted_qty", "is", null);

    let adjustments = 0;
    for (const it of items ?? []) {
      const variance = Number(it.variance ?? 0);
      if (variance === 0) continue;
      // Adjustment movement (positive = add, negative = remove).
      const { error } = await ctx.supabase.from("stock_movements").insert({
        company_id: count.company_id,
        product_id: it.product_id,
        movement_type: "adjustment",
        quantity: Math.abs(variance),
        from_warehouse_id: variance < 0 ? count.warehouse_id : null,
        to_warehouse_id: variance > 0 ? count.warehouse_id : null,
        lot_number: it.lot_number ?? null,
        reason: "stock_count_adjustment",
        reference_type: "stock_count",
        reference_number: data.countId,
        user_id: ctx.userId,
      } as never);
      if (!error) adjustments++;
    }

    await ctx.supabase
      .from("stock_counts")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: ctx.userId,
      })
      .eq("id", data.countId);

    return ok({ adjustments });
  }
);

export const getCountDetail = withCompany<string, { count: StockCount | null; items: StockCountItem[] } | null>(
  async (ctx, countId) => {
    if (ctx.demo) return ok(null);

    const { data: count } = await ctx.supabase
      .from("stock_counts")
      .select("id, name, warehouse_id, status, started_at, closed_at")
      .eq("id", countId)
      .single();
    if (!count) return ok(null);

    const { data: items } = await ctx.supabase
      .from("stock_count_items")
      .select(`
        id, count_id, product_id, lot_number, expected_qty, counted_qty,
        variance, scanned_at,
        product:products(name, sku)
      `)
      .eq("count_id", countId)
      .order("scanned_at", { ascending: false, nullsFirst: false });

    return ok({
      count: {
        id: count.id,
        name: count.name,
        warehouseId: count.warehouse_id,
        status: count.status as CountStatus,
        startedAt: count.started_at,
        closedAt: count.closed_at ?? undefined,
        itemCount: items?.length ?? 0,
        scannedCount: (items ?? []).filter((i) => i.scanned_at).length,
      },
      items: (items ?? []).map((i) => {
        const productRaw = i.product as { name: string; sku: string } | { name: string; sku: string }[] | null;
        const product = Array.isArray(productRaw) ? productRaw[0] ?? null : productRaw;
        return {
          id: i.id,
          countId: i.count_id,
          productId: i.product_id,
          productName: product?.name ?? "",
          productSku: product?.sku ?? "",
          lotNumber: i.lot_number,
          expectedQty: Number(i.expected_qty),
          countedQty: i.counted_qty != null ? Number(i.counted_qty) : null,
          variance: Number(i.variance ?? 0),
          scannedAt: i.scanned_at,
        };
      }),
    });
  }
);
