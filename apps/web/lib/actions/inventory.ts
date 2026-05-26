"use server";

import type { Prisma } from "@prisma/client";
import type { StockMovement, MovementType } from "@/lib/types";
import {
  toStockMovement,
  fromStockMovement,
  fromInventoryLot,
  toExpiringLot,
  type MovementJoinedRow,
  type ExpiringLot,
} from "@/lib/mappers";
import {
  withAuth,
  withCompany,
  ok,
  parseInput,
  z,
  ERR,
} from "@/lib/server";

// ============================================
// GET STOCK MOVEMENTS
// ============================================
export const getStockMovements = withAuth<
  { search?: string; type?: string; warehouseId?: string; limit?: number } | undefined,
  StockMovement[]
>(async (ctx, filters) => {
  const where: Prisma.StockMovementWhereInput = {
    companyId: ctx.companyId,
  };
  if (filters?.type && filters.type !== "all") {
    where.movementType = filters.type as MovementType;
  }
  if (filters?.warehouseId) {
    where.OR = [
      { fromWarehouseId: filters.warehouseId },
      { toWarehouseId: filters.warehouseId },
    ];
  }
  if (filters?.search) {
    where.product = {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { sku: { contains: filters.search, mode: "insensitive" } },
      ],
    };
  }

  const rows = await ctx.prisma.stockMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filters?.limit ?? undefined,
    include: {
      product: { select: { name: true, sku: true } },
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      user: { select: { fullName: true } },
    },
  });

  return ok(rows.map((row) => toStockMovement(row as MovementJoinedRow)));
});

// ============================================
// CREATE STOCK MOVEMENT
// ============================================
const movementInputSchema = z.object({
  productId: z.string(),
  type: z.enum(["in", "out", "transfer", "adjustment"]),
  quantity: z.number().positive("Miktar 0'dan büyük olmalı"),
  warehouseId: z.string(),
  toWarehouseId: z.string().optional(),
  lotNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  reason: z.string().optional(),
  reference: z.string().optional(),
});

export const createStockMovement = withCompany<
  z.input<typeof movementInputSchema>,
  void
>(async (ctx, raw) => {
  const data = parseInput(movementInputSchema, raw);

  // Verify the product belongs to the current company before doing anything.
  const product = await ctx.prisma.product.findFirst({
    where: { id: data.productId, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!product) throw ERR.notFound("Ürün");

  const fromWarehouseId =
    data.type === "out" || data.type === "transfer" ? data.warehouseId : undefined;
  const toWarehouseId =
    data.type === "in" ? data.warehouseId : data.toWarehouseId;

  const moveInsert = fromStockMovement({
    companyId: ctx.companyId,
    productId: data.productId,
    type: data.type as MovementType,
    quantity: data.quantity,
    fromWarehouseId,
    toWarehouseId,
    lotNumber: data.lotNumber,
    expiryDate: data.expiryDate,
    reason: data.reason,
    reference: data.reference,
    referenceType: "manual",
    userId: ctx.userId,
  }) as Prisma.StockMovementUncheckedCreateInput;

  await ctx.prisma.$transaction(async (tx) => {
    await tx.stockMovement.create({ data: moveInsert });

    if (data.type === "in") {
      const invInsert = fromInventoryLot({
        companyId: ctx.companyId,
        productId: data.productId,
        warehouseId: data.warehouseId,
        lotNumber: data.lotNumber,
        expiryDate: data.expiryDate,
        quantity: data.quantity,
        unitCost: 0,
      }) as Prisma.InventoryUncheckedCreateInput;
      await tx.inventory.create({ data: invInsert });
    }
  });

  return ok();
});

// ============================================
// GET EXPIRING LOTS
// ============================================
export const getExpiringLots = withAuth<void, ExpiringLot[]>(async (ctx) => {
  const rows = await ctx.prisma.expiringLot.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { expiryDate: "asc" },
  });
  return ok(rows.map(toExpiringLot));
});

// ============================================
// GET DASHBOARD STATS
// ============================================
export interface DashboardStats {
  totalProducts: number;
  totalStock: number;
  lowStock: number;
  expiringCount: number;
}

export const getDashboardStats = withAuth<void, DashboardStats>(async (ctx) => {
  const [totalProducts, inventoryRows, expiringCount, lowStockCount] =
    await Promise.all([
      ctx.prisma.product.count({
        where: { companyId: ctx.companyId, isActive: true },
      }),
      ctx.prisma.inventory.findMany({
        where: { companyId: ctx.companyId },
        select: { quantity: true },
      }),
      ctx.prisma.expiringLot.count({
        where: {
          companyId: ctx.companyId,
          daysLeft: { gt: 0, lte: 30 },
        },
      }),
      ctx.prisma.productStockSummary.count({
        where: {
          companyId: ctx.companyId,
          stockStatus: { in: ["low", "critical"] },
        },
      }),
    ]);

  const totalStock = inventoryRows.reduce(
    (sum, r) => sum + Number(r.quantity),
    0
  );

  return ok({
    totalProducts,
    totalStock,
    lowStock: lowStockCount,
    expiringCount,
  });
});
