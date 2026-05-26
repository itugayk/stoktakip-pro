"use server";

import { withAuth, withCompany, ok, parseInput, z, ERR } from "@/lib/server";

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  name: string;
  description?: string;
  sortOrder: number;
}

export interface LocationInventoryRow {
  locationId: string;
  locationName: string;
  productId: string | null;
  productName: string | null;
  productSku: string | null;
  productUnit: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  quantity: number;
}

const listSchema = z.object({ warehouseId: z.string() });

export const listLocations = withAuth<
  z.input<typeof listSchema>,
  WarehouseLocation[]
>(async (ctx, raw) => {
  const { warehouseId } = parseInput(listSchema, raw);

  // Verify warehouse belongs to current company.
  const wh = await ctx.prisma.warehouse.findFirst({
    where: { id: warehouseId, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!wh) throw ERR.notFound("Depo");

  const rows = await ctx.prisma.warehouseLocation.findMany({
    where: { warehouseId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return ok(
    rows.map((l) => ({
      id: l.id,
      warehouseId: l.warehouseId,
      name: l.name,
      description: l.description ?? undefined,
      sortOrder: l.sortOrder ?? 0,
    }))
  );
});

const createSchema = z.object({
  warehouseId: z.string(),
  name: z.string().min(1, "Lokasyon adı zorunlu"),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const createLocation = withCompany<
  z.input<typeof createSchema>,
  { id: string }
>(async (ctx, raw) => {
  const data = parseInput(createSchema, raw);

  const wh = await ctx.prisma.warehouse.findFirst({
    where: { id: data.warehouseId, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!wh) throw ERR.notFound("Depo");

  const row = await ctx.prisma.warehouseLocation.create({
    data: {
      warehouseId: data.warehouseId,
      name: data.name,
      description: data.description || null,
      sortOrder: data.sortOrder ?? 0,
    },
    select: { id: true },
  });
  return ok({ id: row.id });
});

export const deleteLocation = withCompany<string, void>(async (ctx, id) => {
  // Scope via the parent warehouse's company.
  const loc = await ctx.prisma.warehouseLocation.findFirst({
    where: { id, warehouse: { companyId: ctx.companyId } },
    select: { id: true },
  });
  if (!loc) throw ERR.notFound("Lokasyon");

  await ctx.prisma.warehouseLocation.delete({ where: { id } });
  return ok();
});

const inventorySchema = z.object({ locationId: z.string() });

export const getLocationInventory = withAuth<
  z.input<typeof inventorySchema>,
  LocationInventoryRow[]
>(async (ctx, raw) => {
  const { locationId } = parseInput(inventorySchema, raw);

  // Verify location belongs to current company via its warehouse.
  const loc = await ctx.prisma.warehouseLocation.findFirst({
    where: { id: locationId, warehouse: { companyId: ctx.companyId } },
    select: { id: true },
  });
  if (!loc) throw ERR.notFound("Lokasyon");

  const rows = await ctx.prisma.locationInventory.findMany({
    where: { locationId },
  });

  return ok(
    rows.map((row) => ({
      locationId: row.locationId,
      locationName: row.locationName,
      productId: row.productId,
      productName: row.productName,
      productSku: row.productSku,
      productUnit: row.productUnit,
      lotNumber: row.lotNumber,
      expiryDate: row.expiryDate ? row.expiryDate.toISOString().slice(0, 10) : null,
      quantity: Number(row.quantity ?? 0),
    }))
  );
});
