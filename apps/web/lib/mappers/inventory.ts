import type { Database } from "@/lib/supabase/database.types";
import type { InventoryLot } from "@/lib/types";

type InventoryRow = Database["public"]["Tables"]["inventory"]["Row"];
type InventoryInsert = Database["public"]["Tables"]["inventory"]["Insert"];
type ExpiringLotRow = Database["public"]["Views"]["expiring_lots"]["Row"];

/**
 * View row for expiring_lots includes derived `days_left` and joined names.
 */
export interface ExpiringLot extends InventoryLot {
  productSku?: string;
  daysLeft: number;
}

export function toInventoryLot(
  row: InventoryRow,
  joined?: { productName?: string; warehouseName?: string }
): InventoryLot {
  return {
    id: row.id,
    productId: row.product_id,
    productName: joined?.productName ?? "",
    lotNumber: row.lot_number ?? "",
    quantity: row.quantity,
    expiryDate: row.expiry_date ?? undefined,
    warehouseId: row.warehouse_id,
    warehouseName: joined?.warehouseName ?? "",
    receivedAt: row.received_at,
  };
}

export function fromInventoryLot(
  lot: Partial<InventoryLot> & {
    companyId?: string;
    locationId?: string;
    unitCost?: number;
    reservedQuantity?: number;
  }
): Partial<InventoryInsert> {
  const out: Partial<InventoryInsert> = {};
  if (lot.companyId !== undefined) out.company_id = lot.companyId;
  if (lot.productId !== undefined) out.product_id = lot.productId;
  if (lot.warehouseId !== undefined) out.warehouse_id = lot.warehouseId;
  if (lot.locationId !== undefined) out.location_id = lot.locationId || null;
  if (lot.lotNumber !== undefined) out.lot_number = lot.lotNumber || null;
  if (lot.expiryDate !== undefined) out.expiry_date = lot.expiryDate || null;
  if (lot.quantity !== undefined) out.quantity = lot.quantity;
  if (lot.reservedQuantity !== undefined) out.reserved_quantity = lot.reservedQuantity;
  if (lot.unitCost !== undefined) out.unit_cost = lot.unitCost;
  return out;
}

export function toExpiringLot(row: ExpiringLotRow): ExpiringLot {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productSku: row.product_sku,
    lotNumber: row.lot_number ?? "",
    quantity: row.quantity,
    expiryDate: row.expiry_date,
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouse_name,
    receivedAt: row.received_at,
    daysLeft: row.days_left,
  };
}
