"use server";

import { withAuth, withCompany, ok, parseInput, z } from "@/lib/server";

// ============================================
// 2.1 — REORDER SUGGESTIONS
// ============================================

export interface ReorderSuggestion {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
  minStock: number;
  shortage: number;
  suggestedQty: number;
  preferredSupplierId?: string;
  lastPurchasePrice: number;
}

export const getReorderSuggestions = withAuth<void, ReorderSuggestion[]>(
  async (ctx) => {
    const rows = await ctx.prisma.reorderSuggestion.findMany({
      where: { companyId: ctx.companyId },
    });

    return ok(
      rows.map((r) => ({
        productId: r.productId,
        name: r.name,
        sku: r.sku,
        unit: r.unit,
        currentStock: Number(r.currentStock ?? 0),
        minStock: Number(r.minStock ?? 0),
        shortage: Number(r.shortage ?? 0),
        suggestedQty: Number(r.suggestedQty ?? 0),
        preferredSupplierId: r.preferredSupplierId ?? undefined,
        lastPurchasePrice: Number(r.lastPurchasePrice ?? 0),
      }))
    );
  }
);

const draftPoSchema = z.object({
  supplierId: z.string(),
  warehouseId: z.string(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        qty: z.number().positive(),
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1, "En az bir kalem"),
});

export const createDraftPOFromSuggestions = withCompany<
  z.input<typeof draftPoSchema>,
  { orderId: string }
>(async (ctx, raw) => {
  const data = parseInput(draftPoSchema, raw);

  const orderNumber = `PO-${Date.now().toString().slice(-8)}`;
  const subtotal = data.items.reduce(
    (sum, it) => sum + it.qty * it.unitPrice,
    0
  );
  const taxAmount = subtotal * 0.2;

  const order = await ctx.prisma.purchaseOrder.create({
    data: {
      companyId: ctx.companyId,
      supplierId: data.supplierId,
      warehouseId: data.warehouseId,
      orderNumber,
      status: "draft",
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount,
      notes: "Otomatik öneri: düşük stoklar için oluşturuldu.",
      userId: ctx.userId,
      items: {
        create: data.items.map((it) => ({
          productId: it.productId,
          quantity: it.qty,
          unitPrice: it.unitPrice,
          total: it.qty * it.unitPrice,
        })),
      },
    },
    select: { id: true },
  });

  return ok({ orderId: order.id });
});

// ============================================
// 2.2 — INVENTORY TURNOVER
// ============================================

export interface TurnoverRow {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  categoryName?: string;
  currentStock: number;
  avgStock: number;
  out30d: number;
  out60d: number;
  out90d: number;
  turnover30d: number;
  turnover90d: number;
  lastOutAt?: string;
}

export const getInventoryTurnover = withAuth<void, TurnoverRow[]>(
  async (ctx) => {
    const rows = await ctx.prisma.inventoryTurnover.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { turnover30d: "desc" },
    });

    return ok(
      rows.map((r) => ({
        productId: r.productId,
        name: r.name,
        sku: r.sku,
        unit: r.unit,
        categoryName: r.categoryName ?? undefined,
        currentStock: Number(r.currentStock ?? 0),
        avgStock: Number(r.avgStock ?? 0),
        out30d: Number(r.out30d ?? 0),
        out60d: Number(r.out60d ?? 0),
        out90d: Number(r.out90d ?? 0),
        turnover30d: Number(r.turnover30d ?? 0),
        turnover90d: Number(r.turnover90d ?? 0),
        lastOutAt: r.lastOutAt?.toISOString() ?? undefined,
      }))
    );
  }
);

// ============================================
// 2.3 — ABC ANALYSIS
// ============================================

export type ABCClass = "A" | "B" | "C";
export interface ABCRow {
  productId: string;
  name: string;
  sku: string;
  revenue: number;
  unitsSold: number;
  cumulativeShare: number;
  abc: ABCClass;
}
export interface ABCResult {
  rows: ABCRow[];
  totals: { revenue: number; aCount: number; bCount: number; cCount: number };
}

const abcSchema = z.object({ period: z.enum(["30d", "90d", "1y"]) });

export const runABCAnalysis = withAuth<z.input<typeof abcSchema>, ABCResult>(
  async (ctx, raw) => {
    const { period } = parseInput(abcSchema, raw);
    const days = period === "30d" ? 30 : period === "90d" ? 90 : 365;
    const cutoff = new Date(Date.now() - days * 86400000);

    // Sum (quantity * unit_price) per product from sales order items where the
    // parent order is in a billable status.
    const items = await ctx.prisma.salesOrderItem.findMany({
      where: {
        order: {
          companyId: ctx.companyId,
          orderDate: { gte: cutoff },
          status: { in: ["approved", "shipped", "delivered"] },
        },
      },
      select: {
        productId: true,
        quantity: true,
        unitPrice: true,
      },
    });

    const productAgg = new Map<string, { revenue: number; unitsSold: number }>();
    for (const it of items) {
      const prev =
        productAgg.get(it.productId) ?? { revenue: 0, unitsSold: 0 };
      prev.revenue += Number(it.quantity) * Number(it.unitPrice);
      prev.unitsSold += Number(it.quantity);
      productAgg.set(it.productId, prev);
    }

    if (productAgg.size === 0) {
      return ok({
        rows: [],
        totals: { revenue: 0, aCount: 0, bCount: 0, cCount: 0 },
      });
    }

    const productIds = Array.from(productAgg.keys());
    const products = await ctx.prisma.product.findMany({
      where: { id: { in: productIds }, companyId: ctx.companyId },
      select: { id: true, name: true, sku: true },
    });

    const rows = products
      .map((p) => {
        const agg = productAgg.get(p.id) ?? { revenue: 0, unitsSold: 0 };
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          revenue: agg.revenue,
          unitsSold: agg.unitsSold,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return ok(classifyABC(rows));
  }
);

function classifyABC(
  rows: {
    productId: string;
    name: string;
    sku: string;
    revenue: number;
    unitsSold: number;
  }[]
): ABCResult {
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  let cum = 0;
  let aCount = 0;
  let bCount = 0;
  let cCount = 0;

  const classified = rows.map((r) => {
    cum += r.revenue;
    const share = totalRevenue > 0 ? cum / totalRevenue : 0;
    const abc: ABCClass = share <= 0.8 ? "A" : share <= 0.95 ? "B" : "C";
    if (abc === "A") aCount++;
    else if (abc === "B") bCount++;
    else cCount++;
    return { ...r, cumulativeShare: share, abc };
  });

  return {
    rows: classified,
    totals: { revenue: totalRevenue, aCount, bCount, cCount },
  };
}

// ============================================
// 2.4 — DEAD STOCK
// ============================================

export interface DeadStockRow {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
  stockValue: number;
  lastOutAt?: string;
  daysIdle: number;
}

const deadStockSchema = z.object({
  days: z.number().int().positive().default(90).optional(),
});

export const getDeadStock = withAuth<
  z.input<typeof deadStockSchema> | undefined,
  DeadStockRow[]
>(async (ctx, raw) => {
  const { days = 90 } = parseInput(deadStockSchema, raw ?? {});

  const rows = await ctx.prisma.deadStock.findMany({
    where: {
      companyId: ctx.companyId,
      daysIdle: { gte: days },
    },
    orderBy: { stockValue: "desc" },
  });

  return ok(
    rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      sku: r.sku,
      unit: r.unit,
      currentStock: Number(r.currentStock ?? 0),
      stockValue: Number(r.stockValue ?? 0),
      lastOutAt: r.lastOutAt?.toISOString() ?? undefined,
      daysIdle: Number(r.daysIdle ?? 0),
    }))
  );
});
