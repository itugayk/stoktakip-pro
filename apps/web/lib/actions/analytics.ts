"use server";

import { withAuth, withCompany, ok, parseInput, z, ERR } from "@/lib/server";
import { demoProducts, demoSuppliers } from "@/lib/demo-data";

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

export const getReorderSuggestions = withAuth<void, ReorderSuggestion[]>(async (ctx) => {
  if (ctx.demo) {
    return ok(
      demoProducts
        .filter((p) => p.currentStock <= p.minStock)
        .map((p) => ({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          currentStock: p.currentStock,
          minStock: p.minStock,
          shortage: Math.max(p.minStock - p.currentStock, 0),
          suggestedQty: Math.max((p.maxStock || p.minStock * 2) - p.currentStock, 0),
          preferredSupplierId: demoSuppliers[0]?.id,
          lastPurchasePrice: p.purchasePrice,
        }))
    );
  }

  const { data, error } = await ctx.supabase.from("v_reorder_suggestions").select("*");
  if (error) throw ERR.database(error.message);

  return ok(
    (data ?? []).map((r) => ({
      productId: r.product_id,
      name: r.name,
      sku: r.sku,
      unit: r.unit,
      currentStock: Number(r.current_stock ?? 0),
      minStock: Number(r.min_stock ?? 0),
      shortage: Number(r.shortage ?? 0),
      suggestedQty: Number(r.suggested_qty ?? 0),
      preferredSupplierId: r.preferred_supplier_id ?? undefined,
      lastPurchasePrice: Number(r.last_purchase_price ?? 0),
    }))
  );
});

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
  if (ctx.demo) return ok({ orderId: `po-${Date.now()}` });

  const orderNumber = `PO-${Date.now().toString().slice(-8)}`;
  const subtotal = data.items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
  const taxAmount = subtotal * 0.2;

  const { data: order, error } = await ctx.supabase
    .from("purchase_orders")
    .insert({
      company_id: ctx.companyId,
      supplier_id: data.supplierId,
      warehouse_id: data.warehouseId,
      order_number: orderNumber,
      status: "draft",
      subtotal,
      tax_amount: taxAmount,
      total_amount: subtotal + taxAmount,
      notes: "Otomatik öneri: düşük stoklar için oluşturuldu.",
      user_id: ctx.userId,
    } as never)
    .select("id")
    .single();
  if (error) throw ERR.database(error.message);

  const lines = data.items.map((it) => ({
    order_id: order.id,
    product_id: it.productId,
    quantity: it.qty,
    unit_price: it.unitPrice,
    total: it.qty * it.unitPrice,
  }));
  const { error: lineErr } = await ctx.supabase
    .from("purchase_order_items")
    .insert(lines as never);
  if (lineErr) throw ERR.database(lineErr.message);

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

export const getInventoryTurnover = withAuth<void, TurnoverRow[]>(async (ctx) => {
  if (ctx.demo) {
    return ok(
      demoProducts.slice(0, 10).map((p, i) => ({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        categoryName: p.categoryName,
        currentStock: p.currentStock,
        avgStock: p.currentStock,
        out30d: Math.floor(Math.random() * 30),
        out60d: Math.floor(Math.random() * 60),
        out90d: Math.floor(Math.random() * 90),
        turnover30d: Math.random() * 2,
        turnover90d: Math.random() * 6,
        lastOutAt: i % 3 === 0 ? undefined : new Date(Date.now() - i * 86400000).toISOString(),
      }))
    );
  }

  const { data, error } = await ctx.supabase
    .from("v_inventory_turnover")
    .select("*")
    .order("turnover_30d", { ascending: false });
  if (error) throw ERR.database(error.message);

  return ok(
    (data ?? []).map((r) => ({
      productId: r.product_id,
      name: r.name,
      sku: r.sku,
      unit: r.unit,
      categoryName: r.category_name ?? undefined,
      currentStock: Number(r.current_stock ?? 0),
      avgStock: Number(r.avg_stock ?? 0),
      out30d: Number(r.out_30d ?? 0),
      out60d: Number(r.out_60d ?? 0),
      out90d: Number(r.out_90d ?? 0),
      turnover30d: Number(r.turnover_30d ?? 0),
      turnover90d: Number(r.turnover_90d ?? 0),
      lastOutAt: r.last_out_at ?? undefined,
    }))
  );
});

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

    if (ctx.demo) {
      // Synthesize from demo data — random revenue.
      const rows = demoProducts
        .map((p) => ({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          revenue: p.salePrice * (10 + Math.random() * 200),
          unitsSold: Math.floor(10 + Math.random() * 200),
        }))
        .sort((a, b) => b.revenue - a.revenue);
      return ok(classifyABC(rows));
    }

    // Real query: sum (qty * unit_price) per product from sales_order_items
    // joined to sales_orders.
    const { data, error } = await ctx.supabase
      .from("sales_order_items")
      .select(`
        product_id,
        quantity,
        unit_price,
        order:sales_orders!inner(order_date, status)
      `)
      .gte("order.order_date", new Date(Date.now() - days * 86400000).toISOString().slice(0, 10))
      .in("order.status", ["approved", "shipped", "delivered"]);
    if (error) throw ERR.database(error.message);

    const productAgg = new Map<string, { revenue: number; unitsSold: number }>();
    for (const row of data ?? []) {
      const r = row as unknown as { product_id: string; quantity: number; unit_price: number };
      const prev = productAgg.get(r.product_id) ?? { revenue: 0, unitsSold: 0 };
      prev.revenue += Number(r.quantity) * Number(r.unit_price);
      prev.unitsSold += Number(r.quantity);
      productAgg.set(r.product_id, prev);
    }

    if (productAgg.size === 0) return ok({ rows: [], totals: { revenue: 0, aCount: 0, bCount: 0, cCount: 0 } });

    const productIds = Array.from(productAgg.keys());
    const { data: products } = await ctx.supabase
      .from("products")
      .select("id, name, sku")
      .in("id", productIds);

    const rows = (products ?? [])
      .map((p) => {
        const agg = productAgg.get(p.id) ?? { revenue: 0, unitsSold: 0 };
        return { productId: p.id, name: p.name, sku: p.sku, revenue: agg.revenue, unitsSold: agg.unitsSold };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return ok(classifyABC(rows));
  }
);

function classifyABC(
  rows: { productId: string; name: string; sku: string; revenue: number; unitsSold: number }[]
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

  return { rows: classified, totals: { revenue: totalRevenue, aCount, bCount, cCount } };
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

const deadStockSchema = z.object({ days: z.number().int().positive().default(90).optional() });

export const getDeadStock = withAuth<z.input<typeof deadStockSchema> | undefined, DeadStockRow[]>(
  async (ctx, raw) => {
    const { days = 90 } = parseInput(deadStockSchema, raw ?? {});

    if (ctx.demo) {
      return ok(
        demoProducts.slice(0, 5).map((p, i) => ({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          currentStock: p.currentStock,
          stockValue: p.currentStock * p.purchasePrice,
          lastOutAt: undefined,
          daysIdle: days + i * 10,
        }))
      );
    }

    // The view always uses 90; if the user picks something else, filter here.
    const { data, error } = await ctx.supabase
      .from("v_dead_stock")
      .select("*")
      .gte("days_idle", days)
      .order("stock_value", { ascending: false });
    if (error) throw ERR.database(error.message);

    return ok(
      (data ?? []).map((r) => ({
        productId: r.product_id,
        name: r.name,
        sku: r.sku,
        unit: r.unit,
        currentStock: Number(r.current_stock ?? 0),
        stockValue: Number(r.stock_value ?? 0),
        lastOutAt: r.last_out_at ?? undefined,
        daysIdle: Number(r.days_idle ?? 0),
      }))
    );
  }
);
