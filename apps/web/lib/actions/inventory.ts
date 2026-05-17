"use server";

import { demoMovements, demoLots, demoProducts } from "@/lib/demo-data";
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
  if (ctx.demo) {
    let results = [...demoMovements];
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (m) => m.productName.toLowerCase().includes(q) || m.productSku.toLowerCase().includes(q)
      );
    }
    if (filters?.type && filters.type !== "all") {
      results = results.filter((m) => m.type === filters.type);
    }
    if (filters?.limit) results = results.slice(0, filters.limit);
    return ok(
      results.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    );
  }

  let query = ctx.supabase
    .from("stock_movements")
    .select(`
      *,
      product:products(name, sku),
      from_warehouse:warehouses!stock_movements_from_warehouse_id_fkey(name),
      to_warehouse:warehouses!stock_movements_to_warehouse_id_fkey(name),
      user:profiles!stock_movements_user_id_fkey(full_name)
    `)
    .order("created_at", { ascending: false });

  if (filters?.type && filters.type !== "all") {
    query = query.eq("movement_type", filters.type);
  }
  if (filters?.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw ERR.database(error.message);

  return ok(
    (data ?? []).map((row) => toStockMovement(row as unknown as MovementJoinedRow))
  );
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
  if (ctx.demo) return ok();

  const fromWarehouseId =
    data.type === "out" || data.type === "transfer" ? data.warehouseId : undefined;
  const toWarehouseId = data.type === "in" ? data.warehouseId : data.toWarehouseId;

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
  });

  const { error: moveError } = await ctx.supabase
    .from("stock_movements")
    .insert(moveInsert as never);
  if (moveError) throw ERR.database(moveError.message);

  if (data.type === "in") {
    const invInsert = fromInventoryLot({
      companyId: ctx.companyId,
      productId: data.productId,
      warehouseId: data.warehouseId,
      lotNumber: data.lotNumber,
      expiryDate: data.expiryDate,
      quantity: data.quantity,
      unitCost: 0,
    });
    const { error: invError } = await ctx.supabase
      .from("inventory")
      .insert(invInsert as never);
    if (invError) throw ERR.database(invError.message);
  }

  return ok();
});

// ============================================
// GET EXPIRING LOTS
// ============================================
export const getExpiringLots = withAuth<void, ExpiringLot[]>(async (ctx) => {
  if (ctx.demo) {
    const today = new Date();
    const lots = demoLots
      .filter((l) => l.expiryDate)
      .map((lot) => {
        const expiry = new Date(lot.expiryDate!);
        const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { ...lot, daysLeft } as ExpiringLot;
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
    return ok(lots);
  }

  const { data, error } = await ctx.supabase
    .from("expiring_lots")
    .select("*")
    .order("expiry_date");

  if (error) throw ERR.database(error.message);
  return ok((data ?? []).map(toExpiringLot));
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
  if (ctx.demo) {
    const totalProducts = demoProducts.length;
    const totalStock = demoProducts.reduce((sum, p) => sum + p.currentStock, 0);
    const lowStock = demoProducts.filter(
      (p) => p.stockStatus === "low" || p.stockStatus === "critical"
    ).length;
    const today = new Date();
    const expiringCount = demoLots.filter((l) => {
      if (!l.expiryDate) return false;
      const days = Math.ceil(
        (new Date(l.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return days > 0 && days <= 30;
    }).length;
    return ok({ totalProducts, totalStock, lowStock, expiringCount });
  }

  const [productsResult, inventoryResult, expiringResult] = await Promise.all([
    ctx.supabase.from("products").select("id", { count: "exact" }).eq("is_active", true),
    ctx.supabase.from("inventory").select("quantity"),
    ctx.supabase
      .from("expiring_lots")
      .select("id", { count: "exact" })
      .lte("days_left", 30)
      .gt("days_left", 0),
  ]);

  const totalProducts = productsResult.count ?? 0;
  const totalStock = (inventoryResult.data ?? []).reduce(
    (sum, r) => sum + (r.quantity || 0),
    0
  );
  const expiringCount = expiringResult.count ?? 0;

  const { count: lowStockCount } = await ctx.supabase
    .from("product_stock_summary")
    .select("product_id", { count: "exact" })
    .in("stock_status", ["low", "critical"]);

  return ok({
    totalProducts,
    totalStock,
    lowStock: lowStockCount ?? 0,
    expiringCount,
  });
});
