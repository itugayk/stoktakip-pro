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

export const listLocations = withAuth<z.input<typeof listSchema>, WarehouseLocation[]>(
  async (ctx, raw) => {
    const { warehouseId } = parseInput(listSchema, raw);
    if (ctx.demo) return ok([]);

    const { data, error } = await ctx.supabase
      .from("warehouse_locations")
      .select("*")
      .eq("warehouse_id", warehouseId)
      .order("sort_order")
      .order("name");
    if (error) throw ERR.database(error.message);

    return ok(
      (data ?? []).map((l) => ({
        id: l.id,
        warehouseId: l.warehouse_id,
        name: l.name,
        description: l.description ?? undefined,
        sortOrder: l.sort_order ?? 0,
      }))
    );
  }
);

const createSchema = z.object({
  warehouseId: z.string(),
  name: z.string().min(1, "Lokasyon adı zorunlu"),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const createLocation = withCompany<z.input<typeof createSchema>, { id: string }>(
  async (ctx, raw) => {
    const data = parseInput(createSchema, raw);
    if (ctx.demo) return ok({ id: `loc-${Date.now()}` });

    const { data: row, error } = await ctx.supabase
      .from("warehouse_locations")
      .insert({
        warehouse_id: data.warehouseId,
        name: data.name,
        description: data.description || null,
        sort_order: data.sortOrder ?? 0,
      } as never)
      .select("id")
      .single();
    if (error) throw ERR.database(error.message);
    return ok({ id: row.id });
  }
);

export const deleteLocation = withCompany<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase.from("warehouse_locations").delete().eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});

const inventorySchema = z.object({ locationId: z.string() });

export const getLocationInventory = withAuth<
  z.input<typeof inventorySchema>,
  LocationInventoryRow[]
>(async (ctx, raw) => {
  const { locationId } = parseInput(inventorySchema, raw);
  if (ctx.demo) return ok([]);

  const { data, error } = await ctx.supabase
    .from("v_location_inventory")
    .select("*")
    .eq("location_id", locationId);
  if (error) throw ERR.database(error.message);

  return ok(
    (data ?? []).map((row) => ({
      locationId: row.location_id,
      locationName: row.location_name,
      productId: row.product_id,
      productName: row.product_name,
      productSku: row.product_sku,
      productUnit: row.product_unit,
      lotNumber: row.lot_number,
      expiryDate: row.expiry_date,
      quantity: Number(row.quantity ?? 0),
    }))
  );
});
