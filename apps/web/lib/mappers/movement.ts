import type { Database } from "@/lib/supabase/database.types";
import type { StockMovement, MovementType } from "@/lib/types";

type MovementRow = Database["public"]["Tables"]["stock_movements"]["Row"];
type MovementInsert = Database["public"]["Tables"]["stock_movements"]["Insert"];

/**
 * Joined row shape used by getStockMovements queries.
 * Supabase returns related rows as nested objects keyed by alias.
 */
export interface MovementJoinedRow extends MovementRow {
  product?: { name: string; sku: string } | null;
  from_warehouse?: { name: string } | null;
  to_warehouse?: { name: string } | null;
  user?: { full_name: string } | null;
}

export function toStockMovement(row: MovementJoinedRow): StockMovement {
  const fromWh = row.from_warehouse;
  const toWh = row.to_warehouse;
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product?.name ?? "",
    productSku: row.product?.sku ?? "",
    type: row.movement_type as MovementType,
    quantity: row.quantity,
    warehouseId: row.from_warehouse_id ?? row.to_warehouse_id ?? "",
    warehouseName: fromWh?.name ?? toWh?.name ?? "",
    toWarehouseId: row.to_warehouse_id ?? undefined,
    toWarehouseName: toWh?.name,
    lotNumber: row.lot_number ?? undefined,
    expiryDate: row.expiry_date ?? undefined,
    reason: row.reason ?? undefined,
    reference: row.reference_number ?? undefined,
    userId: row.user_id,
    userName: row.user?.full_name ?? "",
    createdAt: row.created_at,
  };
}

export function fromStockMovement(
  m: Partial<StockMovement> & {
    companyId?: string;
    fromWarehouseId?: string;
    referenceType?: string;
    unitCost?: number;
    notes?: string;
  }
): Partial<MovementInsert> {
  const out: Partial<MovementInsert> = {};
  if (m.companyId !== undefined) out.company_id = m.companyId;
  if (m.productId !== undefined) out.product_id = m.productId;
  if (m.type !== undefined) out.movement_type = m.type;
  if (m.quantity !== undefined) out.quantity = m.quantity;
  if (m.fromWarehouseId !== undefined) out.from_warehouse_id = m.fromWarehouseId || null;
  if (m.toWarehouseId !== undefined) out.to_warehouse_id = m.toWarehouseId || null;
  if (m.lotNumber !== undefined) out.lot_number = m.lotNumber || null;
  if (m.expiryDate !== undefined) out.expiry_date = m.expiryDate || null;
  if (m.unitCost !== undefined) out.unit_cost = m.unitCost;
  if (m.reason !== undefined) out.reason = m.reason || null;
  if (m.reference !== undefined) out.reference_number = m.reference || null;
  if (m.referenceType !== undefined) out.reference_type = m.referenceType;
  if (m.notes !== undefined) out.notes = m.notes;
  if (m.userId !== undefined) out.user_id = m.userId;
  return out;
}
