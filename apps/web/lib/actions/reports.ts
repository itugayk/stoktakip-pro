"use server";

import { withAuth, ok, parseInput, z } from "@/lib/server";
import { computePartyBalances } from "@/lib/cari/balance";

// ============================================
// 5.2 — COMPARATIVE PERIOD METRICS
// ============================================

export interface PeriodComparison {
  current: {
    from: string;
    to: string;
    revenue: number;
    cost: number;
    orders: number;
    units: number;
  };
  previous: {
    from: string;
    to: string;
    revenue: number;
    cost: number;
    orders: number;
    units: number;
  };
  delta: { revenue: number; cost: number; orders: number; units: number };
  deltaPct: { revenue: number; cost: number; orders: number; units: number };
}

const compareSchema = z.object({
  period: z.enum(["month", "quarter", "year"]).default("month"),
});

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 1;
  return (curr - prev) / prev;
}

export const getPeriodComparison = withAuth<
  z.input<typeof compareSchema> | undefined,
  PeriodComparison
>(async (ctx, raw) => {
  const { period = "month" } = parseInput(compareSchema, raw ?? {});

  const now = new Date();
  let currentFrom: Date;
  const currentTo: Date = now;
  let previousFrom: Date;
  let previousTo: Date;

  if (period === "month") {
    currentFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    previousFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    previousTo = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    currentFrom = new Date(now.getFullYear(), q * 3, 1);
    previousFrom = new Date(now.getFullYear(), (q - 1) * 3, 1);
    previousTo = new Date(now.getFullYear(), q * 3, 0);
  } else {
    currentFrom = new Date(now.getFullYear(), 0, 1);
    previousFrom = new Date(now.getFullYear() - 1, 0, 1);
    previousTo = new Date(now.getFullYear() - 1, 11, 31);
  }

  async function aggregate(from: Date, to: Date) {
    const items = await ctx.prisma.salesOrderItem.findMany({
      where: {
        order: {
          companyId: ctx.companyId,
          orderDate: { gte: from, lte: to },
          status: { in: ["approved", "shipped", "delivered"] },
        },
      },
      select: {
        quantity: true,
        unitPrice: true,
        order: { select: { id: true } },
        product: { select: { purchasePrice: true } },
      },
    });

    let revenue = 0;
    let cost = 0;
    let units = 0;
    const orderIds = new Set<string>();
    for (const r of items) {
      const qty = Number(r.quantity);
      const price = Number(r.unitPrice);
      const purchase = Number(r.product?.purchasePrice ?? 0);
      revenue += qty * price;
      cost += qty * purchase;
      units += qty;
      if (r.order?.id) orderIds.add(r.order.id);
    }
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      revenue,
      cost,
      orders: orderIds.size,
      units,
    };
  }

  const [current, previous] = await Promise.all([
    aggregate(currentFrom, currentTo),
    aggregate(previousFrom, previousTo),
  ]);

  return ok({
    current,
    previous,
    delta: {
      revenue: current.revenue - previous.revenue,
      cost: current.cost - previous.cost,
      orders: current.orders - previous.orders,
      units: current.units - previous.units,
    },
    deltaPct: {
      revenue: pctChange(current.revenue, previous.revenue),
      cost: pctChange(current.cost, previous.cost),
      orders: pctChange(current.orders, previous.orders),
      units: pctChange(current.units, previous.units),
    },
  });
});

// ============================================
// 5.3 — P&L ANALYSIS (FIFO / AVG / LIFO)
// ============================================

export type CostMethod = "FIFO" | "AVG" | "LIFO";

export interface ProfitRow {
  productId: string;
  name: string;
  sku: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
}

export interface ProfitReport {
  rows: ProfitRow[];
  totals: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
  };
}

const profitSchema = z.object({
  from: z.string(),
  to: z.string(),
  method: z.enum(["FIFO", "AVG", "LIFO"]).default("AVG"),
});

export const getProfitReport = withAuth<
  z.input<typeof profitSchema>,
  ProfitReport
>(async (ctx, raw) => {
  const { from, to, method } = parseInput(profitSchema, raw);

  const lines = await ctx.prisma.salesOrderItem.findMany({
    where: {
      order: {
        companyId: ctx.companyId,
        orderDate: { gte: new Date(from), lte: new Date(to) },
        status: { in: ["approved", "shipped", "delivered"] },
      },
    },
    select: {
      productId: true,
      quantity: true,
      unitPrice: true,
    },
  });

  interface Bucket {
    unitsSold: number;
    revenue: number;
    cogs: number;
  }
  const buckets = new Map<string, Bucket>();
  for (const r of lines) {
    const b =
      buckets.get(r.productId) ?? { unitsSold: 0, revenue: 0, cogs: 0 };
    const qty = Number(r.quantity);
    b.unitsSold += qty;
    b.revenue += qty * Number(r.unitPrice);
    buckets.set(r.productId, b);
  }

  const productIds = Array.from(buckets.keys());
  if (productIds.length === 0) {
    return ok({
      rows: [],
      totals: { revenue: 0, cogs: 0, grossProfit: 0, grossMarginPct: 0 },
    });
  }

  const products = await ctx.prisma.product.findMany({
    where: { id: { in: productIds }, companyId: ctx.companyId },
    select: { id: true, name: true, sku: true, purchasePrice: true },
  });

  let costMap = new Map<string, number>();
  for (const p of products) {
    costMap.set(p.id, Number(p.purchasePrice));
  }

  if (method !== "AVG") {
    const lots = await ctx.prisma.inventory.findMany({
      where: {
        productId: { in: productIds },
        companyId: ctx.companyId,
      },
      select: { productId: true, unitCost: true, receivedAt: true },
    });
    const lotsByProduct = new Map<
      string,
      { unitCost: number; receivedAt: Date }[]
    >();
    for (const l of lots) {
      const list = lotsByProduct.get(l.productId) ?? [];
      list.push({ unitCost: Number(l.unitCost), receivedAt: l.receivedAt });
      lotsByProduct.set(l.productId, list);
    }
    const next = new Map<string, number>();
    for (const [id, list] of lotsByProduct) {
      const sorted = [...list].sort(
        (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
      );
      const pick =
        method === "FIFO" ? sorted[0] : sorted[sorted.length - 1];
      if (pick) next.set(id, pick.unitCost);
    }
    // Fall back to AVG for products with no lots.
    for (const [id, fallback] of costMap) {
      if (!next.has(id)) next.set(id, fallback);
    }
    costMap = next;
  }

  const rows: ProfitRow[] = [];
  let totalRev = 0;
  let totalCogs = 0;
  for (const p of products) {
    const b = buckets.get(p.id);
    if (!b) continue;
    const unitCost = costMap.get(p.id) ?? 0;
    const cogs = unitCost * b.unitsSold;
    const grossProfit = b.revenue - cogs;
    rows.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      unitsSold: b.unitsSold,
      revenue: b.revenue,
      cogs,
      grossProfit,
      grossMarginPct: b.revenue > 0 ? grossProfit / b.revenue : 0,
    });
    totalRev += b.revenue;
    totalCogs += cogs;
  }
  rows.sort((a, b) => b.grossProfit - a.grossProfit);

  const totalProfit = totalRev - totalCogs;
  return ok({
    rows,
    totals: {
      revenue: totalRev,
      cogs: totalCogs,
      grossProfit: totalProfit,
      grossMarginPct: totalRev > 0 ? totalProfit / totalRev : 0,
    },
  });
});

// ============================================
// 5.4 — TREND TIME SERIES (daily revenue + units, last N days)
// ============================================

export interface TrendPoint {
  date: string;
  revenue: number;
  units: number;
}

const trendSchema = z.object({
  days: z.number().int().positive().max(365).default(90),
});

export const getRevenueTrend = withAuth<
  z.input<typeof trendSchema> | undefined,
  TrendPoint[]
>(async (ctx, raw) => {
  const { days = 90 } = parseInput(trendSchema, raw ?? {});

  const from = new Date(Date.now() - days * 86400000);

  const items = await ctx.prisma.salesOrderItem.findMany({
    where: {
      order: {
        companyId: ctx.companyId,
        orderDate: { gte: from },
        status: { in: ["approved", "shipped", "delivered"] },
      },
    },
    select: {
      quantity: true,
      unitPrice: true,
      order: { select: { orderDate: true } },
    },
  });

  const byDate = new Map<string, TrendPoint>();
  for (const r of items) {
    if (!r.order?.orderDate) continue;
    const date = r.order.orderDate.toISOString().slice(0, 10);
    const existing = byDate.get(date) ?? { date, revenue: 0, units: 0 };
    existing.revenue += Number(r.quantity) * Number(r.unitPrice);
    existing.units += Number(r.quantity);
    byDate.set(date, existing);
  }

  // Zero-fill missing days.
  const points: TrendPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    points.push(byDate.get(key) ?? { date: key, revenue: 0, units: 0 });
  }
  return ok(points);
});

// ============================================
// 5.5 — İŞLETME KÂR/ZARAR (business-level P&L + cash + cari snapshot)
// ============================================

export interface MethodAmount {
  method: string;
  amount: number;
}

export interface BusinessPnL {
  from: string;
  to: string;
  revenue: number; // POS sales + shipped/delivered sales orders
  cogs: number; // actual FEFO cost consumed (from out movements)
  grossProfit: number;
  grossMarginPct: number;
  purchases: number; // received purchase orders
  expenses: number; // operating expenses
  netProfit: number; // grossProfit - expenses
  receivables: number; // customers owe us (snapshot, all-time)
  payables: number; // we owe suppliers (snapshot, all-time)
  cashIn: MethodAmount[]; // payments received in period, by method
  cashOut: MethodAmount[]; // payments made in period, by method
  expenseByCategory: { category: string; amount: number }[];
}

const pnlSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const getBusinessPnL = withAuth<
  z.input<typeof pnlSchema>,
  BusinessPnL
>(async (ctx, raw) => {
  const { from, to } = parseInput(pnlSchema, raw);
  const gte = new Date(from);
  const lte = new Date(to);

  const [
    saleAgg,
    soAgg,
    outMovements,
    poAgg,
    expenseAgg,
    expenseByCat,
    cashInAgg,
    cashOutAgg,
    balances,
  ] = await Promise.all([
    ctx.prisma.sale.aggregate({
      where: { companyId: ctx.companyId, status: "completed", createdAt: { gte, lte } },
      _sum: { totalAmount: true },
    }),
    ctx.prisma.salesOrder.aggregate({
      where: {
        companyId: ctx.companyId,
        status: { in: ["shipped", "delivered"] },
        orderDate: { gte, lte },
      },
      _sum: { totalAmount: true },
    }),
    ctx.prisma.stockMovement.findMany({
      where: {
        companyId: ctx.companyId,
        movementType: "out",
        referenceType: { in: ["sale", "sales_order"] },
        createdAt: { gte, lte },
      },
      select: { quantity: true, unitCost: true },
    }),
    ctx.prisma.purchaseOrder.aggregate({
      where: {
        companyId: ctx.companyId,
        status: { in: ["received", "partial"] },
        orderDate: { gte, lte },
      },
      _sum: { totalAmount: true },
    }),
    ctx.prisma.expense.aggregate({
      where: { companyId: ctx.companyId, expenseDate: { gte, lte } },
      _sum: { amount: true },
    }),
    ctx.prisma.expense.groupBy({
      by: ["category"],
      where: { companyId: ctx.companyId, expenseDate: { gte, lte } },
      _sum: { amount: true },
    }),
    ctx.prisma.payment.groupBy({
      by: ["method"],
      where: { companyId: ctx.companyId, direction: "inbound", paidAt: { gte, lte } },
      _sum: { amount: true },
    }),
    ctx.prisma.payment.groupBy({
      by: ["method"],
      where: { companyId: ctx.companyId, direction: "outbound", paidAt: { gte, lte } },
      _sum: { amount: true },
    }),
    computePartyBalances(ctx.prisma, ctx.companyId),
  ]);

  const revenue =
    Number(saleAgg._sum.totalAmount ?? 0) + Number(soAgg._sum.totalAmount ?? 0);
  const cogs = outMovements.reduce(
    (s, m) => s + Number(m.quantity) * Number(m.unitCost ?? 0),
    0
  );
  const grossProfit = revenue - cogs;
  const purchases = Number(poAgg._sum.totalAmount ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  const netProfit = grossProfit - expenses;

  let receivables = 0;
  for (const v of balances.customers.values()) if (v > 0) receivables += v;
  let payables = 0;
  for (const v of balances.suppliers.values()) if (v > 0) payables += v;

  return ok({
    from,
    to,
    revenue,
    cogs,
    grossProfit,
    grossMarginPct: revenue > 0 ? grossProfit / revenue : 0,
    purchases,
    expenses,
    netProfit,
    receivables,
    payables,
    cashIn: cashInAgg.map((r) => ({ method: r.method, amount: Number(r._sum.amount ?? 0) })),
    cashOut: cashOutAgg.map((r) => ({ method: r.method, amount: Number(r._sum.amount ?? 0) })),
    expenseByCategory: expenseByCat.map((r) => ({
      category: r.category,
      amount: Number(r._sum.amount ?? 0),
    })),
  });
});
