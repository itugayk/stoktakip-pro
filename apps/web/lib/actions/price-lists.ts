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
  const rows = await ctx.prisma.priceList.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { name: "asc" },
    include: { items: { select: { id: true } } },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      currency: r.currency,
      appliesTo: r.appliesTo as PriceListScope,
      appliesToId: r.appliesToId ?? undefined,
      validFrom: r.validFrom?.toISOString().slice(0, 10) ?? undefined,
      validTo: r.validTo?.toISOString().slice(0, 10) ?? undefined,
      isActive: r.isActive,
      itemCount: r.items.length,
    }))
  );
});

export const upsertPriceList = withCompany<
  z.input<typeof upsertSchema>,
  { id: string }
>(async (ctx, raw) => {
  const data = parseInput(upsertSchema, raw);

  const payload = {
    name: data.name,
    currency: data.currency,
    appliesTo: data.appliesTo,
    appliesToId: data.appliesToId ?? null,
    validFrom: data.validFrom ? new Date(data.validFrom) : null,
    validTo: data.validTo ? new Date(data.validTo) : null,
    isActive: data.isActive,
  };

  if (data.id) {
    const exists = await ctx.prisma.priceList.findFirst({
      where: { id: data.id, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!exists) throw ERR.notFound("Fiyat listesi");

    await ctx.prisma.priceList.update({
      where: { id: data.id },
      data: payload,
    });
    return ok({ id: data.id });
  }

  const row = await ctx.prisma.priceList.create({
    data: { ...payload, companyId: ctx.companyId },
    select: { id: true },
  });
  return ok({ id: row.id });
});

export const deletePriceList = withCompany<string, void>(async (ctx, id) => {
  const res = await ctx.prisma.priceList.deleteMany({
    where: { id, companyId: ctx.companyId },
  });
  if (res.count === 0) throw ERR.notFound("Fiyat listesi");
  return ok();
});

const itemUpsertSchema = z.object({
  listId: z.string(),
  productId: z.string(),
  price: z.number().nonnegative(),
  minQty: z.number().positive().default(1),
});

export const upsertPriceListItem = withCompany<
  z.input<typeof itemUpsertSchema>,
  void
>(async (ctx, raw) => {
  const data = parseInput(itemUpsertSchema, raw);

  // Verify the parent list is in this company.
  const list = await ctx.prisma.priceList.findFirst({
    where: { id: data.listId, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!list) throw ERR.notFound("Fiyat listesi");

  await ctx.prisma.priceListItem.upsert({
    where: {
      priceListId_productId_minQty: {
        priceListId: data.listId,
        productId: data.productId,
        minQty: data.minQty,
      },
    },
    update: { price: data.price },
    create: {
      priceListId: data.listId,
      productId: data.productId,
      price: data.price,
      minQty: data.minQty,
    },
  });
  return ok();
});

export const getPriceListItems = withAuth<string, PriceListItem[]>(
  async (ctx, listId) => {
    // Verify ownership.
    const list = await ctx.prisma.priceList.findFirst({
      where: { id: listId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!list) throw ERR.notFound("Fiyat listesi");

    const rows = await ctx.prisma.priceListItem.findMany({
      where: { priceListId: listId },
    });
    return ok(
      rows.map((r) => ({
        id: r.id,
        productId: r.productId,
        price: Number(r.price),
        minQty: Number(r.minQty),
      }))
    );
  }
);

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
  const today = new Date();

  const lists = await ctx.prisma.priceList.findMany({
    where: {
      companyId: ctx.companyId,
      isActive: true,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: today } }] },
        { OR: [{ validTo: null }, { validTo: { gte: today } }] },
      ],
    },
    select: { id: true, appliesTo: true, appliesToId: true },
  });

  const candidateLists = lists.filter((l) => {
    if (l.appliesTo === "all") return true;
    if (l.appliesTo === "customer") return l.appliesToId === data.customerId;
    if (l.appliesTo === "supplier") return l.appliesToId === data.supplierId;
    return false;
  });

  // Prefer scoped over "all".
  candidateLists.sort((a, b) => (a.appliesTo === "all" ? 1 : -1));

  for (const list of candidateLists) {
    const item = await ctx.prisma.priceListItem.findFirst({
      where: {
        priceListId: list.id,
        productId: data.productId,
        minQty: { lte: data.qty },
      },
      orderBy: { minQty: "desc" },
      select: { price: true },
    });
    if (item) {
      return ok({ price: Number(item.price), source: "list", listId: list.id });
    }
  }

  // Fallback to product default.
  const product = await ctx.prisma.product.findFirst({
    where: { id: data.productId, companyId: ctx.companyId },
    select: { salePrice: true, purchasePrice: true },
  });
  const fallback = data.supplierId
    ? product?.purchasePrice
    : product?.salePrice;
  return ok({ price: Number(fallback ?? 0), source: "default" });
});
