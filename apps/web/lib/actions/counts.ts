"use server";

import { withCompany, ok, parseInput, z, ERR } from "@/lib/server";

export type CountStatus =
  | "open"
  | "in_progress"
  | "review"
  | "closed"
  | "cancelled";

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

export const createCount = withCompany<
  z.input<typeof createSchema>,
  { countId: string; itemCount: number }
>(async (ctx, raw) => {
  const data = parseInput(createSchema, raw);

  // Verify warehouse belongs to this company.
  const wh = await ctx.prisma.warehouse.findFirst({
    where: { id: data.warehouseId, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!wh) throw ERR.notFound("Depo");

  const count = await ctx.prisma.stockCount.create({
    data: {
      companyId: ctx.companyId,
      warehouseId: data.warehouseId,
      name: data.name || null,
      scope: { categories: data.categoryIds ?? [] },
      notes: data.notes || null,
      startedById: ctx.userId,
    },
    select: { id: true },
  });

  // Seed items from current inventory rows in scope.
  const inv = await ctx.prisma.inventory.findMany({
    where: {
      warehouseId: data.warehouseId,
      companyId: ctx.companyId,
      ...(data.categoryIds && data.categoryIds.length > 0
        ? { product: { categoryId: { in: data.categoryIds } } }
        : {}),
    },
    select: { productId: true, lotNumber: true, quantity: true },
  });

  let itemCount = 0;
  if (inv.length > 0) {
    const res = await ctx.prisma.stockCountItem.createMany({
      data: inv.map((row) => ({
        countId: count.id,
        productId: row.productId,
        lotNumber: row.lotNumber ?? null,
        expectedQty: row.quantity,
      })),
      skipDuplicates: true,
    });
    itemCount = res.count;
  }

  return ok({ countId: count.id, itemCount });
});

export const listCounts = withCompany<void, StockCount[]>(async (ctx) => {
  const rows = await ctx.prisma.stockCount.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { startedAt: "desc" },
    include: {
      items: { select: { id: true, scannedAt: true } },
    },
  });

  return ok(
    rows.map((c) => ({
      id: c.id,
      name: c.name,
      warehouseId: c.warehouseId,
      status: c.status as CountStatus,
      startedAt: c.startedAt.toISOString(),
      closedAt: c.closedAt?.toISOString() ?? undefined,
      itemCount: c.items.length,
      scannedCount: c.items.filter((i) => i.scannedAt).length,
    }))
  );
});

const scanSchema = z.object({
  countId: z.string(),
  productId: z.string(),
  lotNumber: z.string().optional(),
  countedQty: z.number().nonnegative(),
});

export const recordCountScan = withCompany<z.input<typeof scanSchema>, void>(
  async (ctx, raw) => {
    const data = parseInput(scanSchema, raw);

    // Verify the count belongs to this company.
    const count = await ctx.prisma.stockCount.findFirst({
      where: { id: data.countId, companyId: ctx.companyId },
      select: { id: true, status: true },
    });
    if (!count) throw ERR.notFound("Sayım");

    const existing = await ctx.prisma.stockCountItem.findFirst({
      where: {
        countId: data.countId,
        productId: data.productId,
        lotNumber: data.lotNumber ?? null,
      },
      select: { id: true },
    });

    if (existing) {
      await ctx.prisma.stockCountItem.update({
        where: { id: existing.id },
        data: {
          countedQty: data.countedQty,
          scannedById: ctx.userId,
          scannedAt: new Date(),
        },
      });
    } else {
      await ctx.prisma.stockCountItem.create({
        data: {
          countId: data.countId,
          productId: data.productId,
          lotNumber: data.lotNumber ?? null,
          expectedQty: 0,
          countedQty: data.countedQty,
          scannedById: ctx.userId,
          scannedAt: new Date(),
        },
      });
    }

    if (count.status === "open") {
      await ctx.prisma.stockCount.update({
        where: { id: data.countId },
        data: { status: "in_progress" },
      });
    }

    return ok();
  }
);

const closeSchema = z.object({ countId: z.string() });

export const closeCount = withCompany<
  z.input<typeof closeSchema>,
  { adjustments: number }
>(async (ctx, raw) => {
  const data = parseInput(closeSchema, raw);

  const count = await ctx.prisma.stockCount.findFirst({
    where: { id: data.countId, companyId: ctx.companyId },
    select: { warehouseId: true, companyId: true },
  });
  if (!count) throw ERR.notFound("Sayım");

  const items = await ctx.prisma.stockCountItem.findMany({
    where: {
      countId: data.countId,
      countedQty: { not: null },
    },
    select: {
      productId: true,
      lotNumber: true,
      variance: true,
    },
  });

  const adjustments = await ctx.prisma.$transaction(async (tx) => {
    let created = 0;
    for (const it of items) {
      const variance = Number(it.variance ?? 0);
      if (variance === 0) continue;
      await tx.stockMovement.create({
        data: {
          companyId: count.companyId,
          productId: it.productId,
          movementType: "adjustment",
          quantity: Math.abs(variance),
          fromWarehouseId: variance < 0 ? count.warehouseId : null,
          toWarehouseId: variance > 0 ? count.warehouseId : null,
          lotNumber: it.lotNumber ?? null,
          reason: "stock_count_adjustment",
          referenceType: "stock_count",
          referenceNumber: data.countId,
          userId: ctx.userId,
        },
      });
      created++;
    }
    await tx.stockCount.update({
      where: { id: data.countId },
      data: {
        status: "closed",
        closedAt: new Date(),
        closedById: ctx.userId,
      },
    });
    return created;
  });

  return ok({ adjustments });
});

export const getCountDetail = withCompany<
  string,
  { count: StockCount | null; items: StockCountItem[] } | null
>(async (ctx, countId) => {
  const count = await ctx.prisma.stockCount.findFirst({
    where: { id: countId, companyId: ctx.companyId },
    select: {
      id: true,
      name: true,
      warehouseId: true,
      status: true,
      startedAt: true,
      closedAt: true,
    },
  });
  if (!count) return ok(null);

  const items = await ctx.prisma.stockCountItem.findMany({
    where: { countId },
    orderBy: [{ scannedAt: { sort: "desc", nulls: "last" } }],
    include: {
      product: { select: { name: true, sku: true } },
    },
  });

  return ok({
    count: {
      id: count.id,
      name: count.name,
      warehouseId: count.warehouseId,
      status: count.status as CountStatus,
      startedAt: count.startedAt.toISOString(),
      closedAt: count.closedAt?.toISOString() ?? undefined,
      itemCount: items.length,
      scannedCount: items.filter((i) => i.scannedAt).length,
    },
    items: items.map((i) => ({
      id: i.id,
      countId: i.countId,
      productId: i.productId,
      productName: i.product?.name ?? "",
      productSku: i.product?.sku ?? "",
      lotNumber: i.lotNumber,
      expectedQty: Number(i.expectedQty),
      countedQty: i.countedQty != null ? Number(i.countedQty) : null,
      variance: Number(i.variance ?? 0),
      scannedAt: i.scannedAt?.toISOString() ?? null,
    })),
  });
});
