import type { Database } from "@/lib/supabase/database.types";
import type { Warehouse } from "@/lib/types";

type WarehouseRow = Database["public"]["Tables"]["warehouses"]["Row"];
type WarehouseInsert = Database["public"]["Tables"]["warehouses"]["Insert"];

export interface WarehouseJoinedRow extends WarehouseRow {
  manager?: { full_name: string } | null;
}

export function toWarehouse(
  row: WarehouseJoinedRow,
  stats?: { totalProducts: number; totalQuantity: number }
): Warehouse {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    managerId: row.manager_id ?? undefined,
    managerName: row.manager?.full_name,
    isActive: row.is_active,
    totalProducts: stats?.totalProducts ?? 0,
    totalQuantity: stats?.totalQuantity ?? 0,
  };
}

export function fromWarehouse(
  w: Partial<Warehouse> & { companyId?: string }
): Partial<WarehouseInsert> {
  const out: Partial<WarehouseInsert> = {};
  if (w.companyId !== undefined) out.company_id = w.companyId;
  if (w.name !== undefined) out.name = w.name;
  if (w.address !== undefined) out.address = w.address || null;
  if (w.managerId !== undefined) out.manager_id = w.managerId || null;
  if (w.isActive !== undefined) out.is_active = w.isActive;
  return out;
}
