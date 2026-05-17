"use server";

import { withCompany, ok, parseInput, z, ERR } from "@/lib/server";
import { fromProduct } from "@/lib/mappers";

const bulkImportSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().min(1),
        sku: z.string().min(1),
        barcode: z.string().optional(),
        categoryName: z.string().optional(),
        unit: z.string().default("adet"),
        minStock: z.number().nonnegative(),
        maxStock: z.number().nonnegative(),
        purchasePrice: z.number().nonnegative(),
        salePrice: z.number().nonnegative(),
        description: z.string().optional(),
      })
    )
    .min(1),
});

/**
 * Bulk-upsert products from an Excel import. SKU is the natural key —
 * existing rows are updated, new rows inserted. Categories are matched by
 * name and auto-created when missing.
 */
export const bulkImportProducts = withCompany<
  z.input<typeof bulkImportSchema>,
  { created: number; updated: number; errors: { sku: string; message: string }[] }
>(async (ctx, raw) => {
  const { rows } = parseInput(bulkImportSchema, raw);
  if (ctx.demo) return ok({ created: rows.length, updated: 0, errors: [] });

  // Pre-load categories (small table).
  const { data: existingCats } = await ctx.supabase
    .from("categories")
    .select("id, name")
    .eq("company_id", ctx.companyId);
  const catByName = new Map<string, string>(
    (existingCats ?? []).map((c) => [c.name.toLowerCase(), c.id])
  );

  // Auto-create missing categories in a batch.
  const missingCategories = new Set<string>();
  for (const r of rows) {
    if (r.categoryName && !catByName.has(r.categoryName.toLowerCase())) {
      missingCategories.add(r.categoryName);
    }
  }
  if (missingCategories.size > 0) {
    const inserts = Array.from(missingCategories).map((name) => ({
      company_id: ctx.companyId,
      name,
    }));
    const { data: created } = await ctx.supabase
      .from("categories")
      .insert(inserts as never)
      .select("id, name");
    for (const c of created ?? []) catByName.set(c.name.toLowerCase(), c.id);
  }

  // Pre-load existing SKUs to decide insert-vs-update.
  const skus = rows.map((r) => r.sku);
  const { data: existingProducts } = await ctx.supabase
    .from("products")
    .select("id, sku")
    .eq("company_id", ctx.companyId)
    .in("sku", skus);
  const existingBySku = new Map<string, string>(
    (existingProducts ?? []).map((p) => [p.sku, p.id])
  );

  let created = 0;
  let updated = 0;
  const errors: { sku: string; message: string }[] = [];

  for (const r of rows) {
    const categoryId = r.categoryName ? catByName.get(r.categoryName.toLowerCase()) : undefined;
    const patch = fromProduct({
      name: r.name,
      sku: r.sku,
      barcode: r.barcode,
      categoryId: categoryId ?? "",
      unit: r.unit,
      minStock: r.minStock,
      maxStock: r.maxStock,
      purchasePrice: r.purchasePrice,
      salePrice: r.salePrice,
      description: r.description,
      companyId: ctx.companyId,
    });

    const existingId = existingBySku.get(r.sku);
    if (existingId) {
      const { error } = await ctx.supabase
        .from("products")
        .update(patch)
        .eq("id", existingId);
      if (error) errors.push({ sku: r.sku, message: error.message });
      else updated++;
    } else {
      const { error } = await ctx.supabase.from("products").insert(patch as never);
      if (error) errors.push({ sku: r.sku, message: error.message });
      else created++;
    }
  }

  return ok({ created, updated, errors });
});

// ============================================
// Account statements (customer / supplier) — xlsx-ready export
// ============================================

const statementSchema = z.object({
  partnerType: z.enum(["customer", "supplier"]),
  partnerId: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export interface StatementRow {
  date: string;
  orderNumber: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export const getPartnerStatement = withCompany<
  z.input<typeof statementSchema>,
  StatementRow[]
>(async (ctx, raw) => {
  const data = parseInput(statementSchema, raw);
  if (ctx.demo) return ok([]);

  const table = data.partnerType === "customer" ? "sales_orders" : "purchase_orders";
  const partnerCol = data.partnerType === "customer" ? "customer_id" : "supplier_id";

  let q = ctx.supabase
    .from(table)
    .select("id, order_number, order_date, total_amount, status")
    .eq(partnerCol, data.partnerId)
    .order("order_date");
  if (data.from) q = q.gte("order_date", data.from);
  if (data.to) q = q.lte("order_date", data.to);

  const { data: orders, error } = await q;
  if (error) throw ERR.database(error.message);

  let balance = 0;
  return ok(
    (orders ?? []).map((o) => {
      const amount = Number(o.total_amount ?? 0);
      // Customer order: invoice = debit (we owe them nothing; they owe us)
      // Supplier order: invoice = credit (we owe them)
      const debit = data.partnerType === "customer" ? amount : 0;
      const credit = data.partnerType === "customer" ? 0 : amount;
      balance += debit - credit;
      return {
        date: o.order_date,
        orderNumber: o.order_number,
        description: `${o.status} — ${o.order_number}`,
        debit,
        credit,
        balance,
      };
    })
  );
});
