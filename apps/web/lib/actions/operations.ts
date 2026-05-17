"use server";

import { demoWarehouses, demoSuppliers, demoCustomers } from "@/lib/demo-data";
import type { Warehouse, Supplier, Customer } from "@/lib/types";
import {
  toWarehouse,
  fromWarehouse,
  toSupplier,
  fromSupplier,
  toCustomer,
  fromCustomer,
  type WarehouseJoinedRow,
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
// WAREHOUSES
// ============================================
export const getWarehouses = withAuth<void, Warehouse[]>(async (ctx) => {
  if (ctx.demo) return ok(demoWarehouses);

  const { data, error } = await ctx.supabase
    .from("warehouses")
    .select(`
      *,
      manager:profiles!warehouses_manager_id_fkey(full_name)
    `)
    .eq("is_active", true)
    .order("name");

  if (error) throw ERR.database(error.message);

  const { data: inventoryData } = await ctx.supabase
    .from("inventory")
    .select("warehouse_id, product_id, quantity");

  const stats = new Map<string, { products: Set<string>; totalQty: number }>();
  (inventoryData ?? []).forEach((inv) => {
    const s = stats.get(inv.warehouse_id) ?? { products: new Set<string>(), totalQty: 0 };
    s.products.add(inv.product_id);
    s.totalQty += inv.quantity || 0;
    stats.set(inv.warehouse_id, s);
  });

  return ok(
    (data ?? []).map((row) => {
      const wh = row as unknown as WarehouseJoinedRow;
      const s = stats.get(wh.id);
      return toWarehouse(wh, {
        totalProducts: s?.products.size ?? 0,
        totalQuantity: s?.totalQty ?? 0,
      });
    })
  );
});

const warehouseInputSchema = z.object({
  name: z.string().min(1, "Depo adı zorunlu"),
  address: z.string().optional(),
  managerId: z.string().optional(),
});

export const createWarehouse = withCompany<
  z.input<typeof warehouseInputSchema>,
  void
>(async (ctx, raw) => {
  const data = parseInput(warehouseInputSchema, raw);
  if (ctx.demo) return ok();

  const insert = fromWarehouse({ ...data, companyId: ctx.companyId });
  const { error } = await ctx.supabase.from("warehouses").insert(insert as never);
  if (error) throw ERR.database(error.message);
  return ok();
});

export const deleteWarehouse = withCompany<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase.from("warehouses").delete().eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});

// ============================================
// SUPPLIERS
// ============================================
export const getSuppliers = withAuth<void, Supplier[]>(async (ctx) => {
  if (ctx.demo) return ok(demoSuppliers);

  const { data, error } = await ctx.supabase
    .from("suppliers")
    .select("*")
    .order("name");

  if (error) throw ERR.database(error.message);
  return ok((data ?? []).map((s) => toSupplier(s)));
});

const supplierInputSchema = z.object({
  name: z.string().min(1, "Tedarikçi adı zorunlu"),
  contactPerson: z.string().optional(),
  email: z.string().email("Geçersiz e-posta").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
});

export const createSupplier = withCompany<
  z.input<typeof supplierInputSchema>,
  void
>(async (ctx, raw) => {
  const data = parseInput(supplierInputSchema, raw);
  if (ctx.demo) return ok();

  const insert = fromSupplier({ ...data, companyId: ctx.companyId });
  const { error } = await ctx.supabase.from("suppliers").insert(insert as never);
  if (error) throw ERR.database(error.message);
  return ok();
});

export const deleteSupplier = withCompany<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase.from("suppliers").delete().eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});

// ============================================
// CUSTOMERS
// ============================================
export const getCustomers = withAuth<void, Customer[]>(async (ctx) => {
  if (ctx.demo) return ok(demoCustomers);

  const { data, error } = await ctx.supabase
    .from("customers")
    .select("*")
    .order("name");

  if (error) throw ERR.database(error.message);
  return ok((data ?? []).map((c) => toCustomer(c)));
});

const customerInputSchema = z.object({
  name: z.string().min(1, "Müşteri adı zorunlu"),
  contactPerson: z.string().optional(),
  email: z.string().email("Geçersiz e-posta").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
});

export const createCustomer = withCompany<
  z.input<typeof customerInputSchema>,
  void
>(async (ctx, raw) => {
  const data = parseInput(customerInputSchema, raw);
  if (ctx.demo) return ok();

  const insert = fromCustomer({ ...data, companyId: ctx.companyId });
  const { error } = await ctx.supabase.from("customers").insert(insert as never);
  if (error) throw ERR.database(error.message);
  return ok();
});

export const deleteCustomer = withCompany<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase.from("customers").delete().eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});
