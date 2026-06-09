"use server";

import type { Prisma } from "@prisma/client";
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
  withRole,
  warehouseScope,
  ok,
  parseInput,
  z,
  ERR,
} from "@/lib/server";
import { assertWithinLimit } from "@/lib/billing/enforce";

// ============================================
// WAREHOUSES
// ============================================
export const getWarehouses = withAuth<void, Warehouse[]>(async (ctx) => {
  const scope = warehouseScope(ctx);
  const [warehouses, inventoryRows] = await Promise.all([
    ctx.prisma.warehouse.findMany({
      where: {
        companyId: ctx.companyId,
        isActive: true,
        ...(scope ? { id: { in: scope } } : {}),
      },
      orderBy: { name: "asc" },
      include: { manager: { select: { fullName: true } } },
    }),
    ctx.prisma.inventory.findMany({
      where: { companyId: ctx.companyId },
      select: { warehouseId: true, productId: true, quantity: true },
    }),
  ]);

  const stats = new Map<
    string,
    { products: Set<string>; totalQty: number }
  >();
  for (const inv of inventoryRows) {
    const s =
      stats.get(inv.warehouseId) ??
      { products: new Set<string>(), totalQty: 0 };
    s.products.add(inv.productId);
    s.totalQty += Number(inv.quantity);
    stats.set(inv.warehouseId, s);
  }

  return ok(
    warehouses.map((wh) => {
      const s = stats.get(wh.id);
      return toWarehouse(wh as WarehouseJoinedRow, {
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

export const createWarehouse = withRole<
  z.input<typeof warehouseInputSchema>,
  void
>(["admin", "manager"], async (ctx, raw) => {
  const data = parseInput(warehouseInputSchema, raw);
  await assertWithinLimit(ctx, "warehouses");

  if (data.managerId) {
    const mgr = await ctx.prisma.user.findFirst({
      where: { id: data.managerId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!mgr) throw ERR.validation("Sorumlu bulunamadı", "managerId");
  }

  const insert = fromWarehouse({
    ...data,
    companyId: ctx.companyId,
  }) as Prisma.WarehouseUncheckedCreateInput;

  await ctx.prisma.warehouse.create({ data: insert });
  return ok();
});

const warehouseUpdateSchema = z.object({
  id: z.string(),
  patch: z
    .object({
      name: z.string().min(1, "Depo adı zorunlu").optional(),
      address: z.string().optional().nullable(),
      managerId: z.string().optional().nullable(),
    })
    .refine((v) => Object.keys(v).length > 0, {
      message: "Güncellenecek alan yok",
    }),
});

export const updateWarehouse = withRole<
  z.input<typeof warehouseUpdateSchema>,
  void
>(["admin", "manager"], async (ctx, raw) => {
  const { id, patch } = parseInput(warehouseUpdateSchema, raw);

  // Verify ownership before update.
  const exists = await ctx.prisma.warehouse.findFirst({
    where: { id, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!exists) throw ERR.notFound("Depo");

  // A chosen manager must be a user in this company.
  if (patch.managerId) {
    const mgr = await ctx.prisma.user.findFirst({
      where: { id: patch.managerId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!mgr) throw ERR.validation("Sorumlu bulunamadı", "managerId");
  }

  const update = fromWarehouse(patch);
  await ctx.prisma.warehouse.update({ where: { id }, data: update });
  return ok();
});

export const deleteWarehouse = withRole<string, void>(
  ["admin", "manager"],
  async (ctx, id) => {
    const res = await ctx.prisma.warehouse.deleteMany({
      where: { id, companyId: ctx.companyId },
    });
    if (res.count === 0) throw ERR.notFound("Depo");
    return ok();
  }
);

// ============================================
// SUPPLIERS
// ============================================
export const getSuppliers = withAuth<void, Supplier[]>(async (ctx) => {
  const rows = await ctx.prisma.supplier.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { name: "asc" },
  });
  return ok(rows.map((s) => toSupplier(s)));
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
  const insert = fromSupplier({
    ...data,
    companyId: ctx.companyId,
  }) as Prisma.SupplierUncheckedCreateInput;
  await ctx.prisma.supplier.create({ data: insert });
  return ok();
});

export const deleteSupplier = withCompany<string, void>(async (ctx, id) => {
  const res = await ctx.prisma.supplier.deleteMany({
    where: { id, companyId: ctx.companyId },
  });
  if (res.count === 0) throw ERR.notFound("Tedarikçi");
  return ok();
});

// ============================================
// CUSTOMERS
// ============================================
export const getCustomers = withAuth<void, Customer[]>(async (ctx) => {
  const rows = await ctx.prisma.customer.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { name: "asc" },
  });
  return ok(rows.map((c) => toCustomer(c)));
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
  const insert = fromCustomer({
    ...data,
    companyId: ctx.companyId,
  }) as Prisma.CustomerUncheckedCreateInput;
  await ctx.prisma.customer.create({ data: insert });
  return ok();
});

export const deleteCustomer = withCompany<string, void>(async (ctx, id) => {
  const res = await ctx.prisma.customer.deleteMany({
    where: { id, companyId: ctx.companyId },
  });
  if (res.count === 0) throw ERR.notFound("Müşteri");
  return ok();
});
