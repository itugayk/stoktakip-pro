"use server";

import { withAuth, withCompany, ok, parseInput, z, ERR } from "@/lib/server";

export type PriceListScope = "all" | "customer" | "supplier" | "tag";

export interface PriceList {
  id: string;
  name: string;
  currency: string;
  appliesTo: PriceListScope;
  appliesToId?: string;
  validFrom?: string;
  validTo?: string;
  isActive: boolean;
  itemCount: number;
}

export interface PriceListItem {
  id: string;
  productId: string;
  price: number;
  minQty: number;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Liste adı zorunlu"),
  currency: z.string().default("TRY"),
  appliesTo: z.enum(["all", "customer", "supplier", "tag"]),
  appliesToId: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const listPriceLists = withAuth<void, PriceList[]>(async (ctx) => {
  if (ctx.demo) return ok([]);

  const { data, error } = await ctx.supabase
    .from("price_lists")
    .select("*, items:price_list_items(id)")
    .order("name");
  if (error) throw ERR.database(error.message);

  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      currency: r.currency,
      appliesTo: r.applies_to as PriceListScope,
      appliesToId: r.applies_to_id ?? undefined,
      validFrom: r.valid_from ?? undefined,
      validTo: r.valid_to ?? undefined,
      isActive: r.is_active,
      itemCount: ((r.items as { id: string }[]) ?? []).length,
    }))
  );
});

export const upsertPriceList = withCompany<z.input<typeof upsertSchema>, { id: string }>(
  async (ctx, raw) => {
    const data = parseInput(upsertSchema, raw);
    if (ctx.demo) return ok({ id: data.id ?? `pl-${Date.now()}` });

    const payload = {
      name: data.name,
      currency: data.currency,
      applies_to: data.appliesTo,
      applies_to_id: data.appliesToId ?? null,
      valid_from: data.validFrom ?? null,
      valid_to: data.validTo ?? null,
      is_active: data.isActive,
    };

    if (data.id) {
      const { error } = await ctx.supabase
        .from("price_lists")
        .update(payload)
        .eq("id", data.id);
      if (error) throw ERR.database(error.message);
      return ok({ id: data.id });
    }

    const { data: row, error } = await ctx.supabase
      .from("price_lists")
      .insert({ ...payload, company_id: ctx.companyId } as never)
      .select("id")
      .single();
    if (error) throw ERR.database(error.message);
    return ok({ id: row.id });
  }
);

export const deletePriceList = withCompany<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase.from("price_lists").delete().eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});

const itemUpsertSchema = z.object({
  listId: z.string(),
  productId: z.string(),
  price: z.number().nonnegative(),
  minQty: z.number().positive().default(1),
});

export const upsertPriceListItem = withCompany<z.input<typeof itemUpsertSchema>, void>(
  async (ctx, raw) => {
    const data = parseInput(itemUpsertSchema, raw);
    if (ctx.demo) return ok();
    const { error } = await ctx.supabase
      .from("price_list_items")
      .upsert({
        price_list_id: data.listId,
        product_id: data.productId,
        price: data.price,
        min_qty: data.minQty,
      } as never, { onConflict: "price_list_id,product_id,min_qty" });
    if (error) throw ERR.database(error.message);
    return ok();
  }
);

export const getPriceListItems = withAuth<string, PriceListItem[]>(async (ctx, listId) => {
  if (ctx.demo) return ok([]);
  const { data, error } = await ctx.supabase
    .from("price_list_items")
    .select("*")
    .eq("price_list_id", listId);
  if (error) throw ERR.database(error.message);
  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      productId: r.product_id,
      price: Number(r.price),
      minQty: Number(r.min_qty),
    }))
  );
});

const resolveSchema = z.object({
  productId: z.string(),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  qty: z.number().positive().default(1),
});

/**
 * Resolve the best applicable price for (product, partner, qty). Order:
 *   1. List scoped to the specific customer/supplier
 *   2. List scoped to "all"
 *   3. product.sale_price / purchase_price fallback
 */
export const resolvePrice = withAuth<
  z.input<typeof resolveSchema>,
  { price: number; source: "list" | "default"; listId?: string }
>(async (ctx, raw) => {
  const data = parseInput(resolveSchema, raw);

  if (ctx.demo) return ok({ price: 0, source: "default" });

  const today = new Date().toISOString().slice(0, 10);
  const { data: lists } = await ctx.supabase
    .from("price_lists")
    .select("id, applies_to, applies_to_id")
    .eq("is_active", true)
    .or(`valid_from.is.null,valid_from.lte.${today}`)
    .or(`valid_to.is.null,valid_to.gte.${today}`);

  const candidateLists = (lists ?? []).filter((l) => {
    if (l.applies_to === "all") return true;
    if (l.applies_to === "customer") return l.applies_to_id === data.customerId;
    if (l.applies_to === "supplier") return l.applies_to_id === data.supplierId;
    return false;
  });

  // Prefer scoped over "all".
  candidateLists.sort((a, b) => (a.applies_to === "all" ? 1 : -1));

  for (const list of candidateLists) {
    const { data: item } = await ctx.supabase
      .from("price_list_items")
      .select("price, min_qty")
      .eq("price_list_id", list.id)
      .eq("product_id", data.productId)
      .lte("min_qty", data.qty)
      .order("min_qty", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (item) return ok({ price: Number(item.price), source: "list", listId: list.id });
  }

  // Fallback to product default.
  const { data: product } = await ctx.supabase
    .from("products")
    .select("sale_price, purchase_price")
    .eq("id", data.productId)
    .single();
  const fallback = data.supplierId ? product?.purchase_price : product?.sale_price;
  return ok({ price: Number(fallback ?? 0), source: "default" });
});
