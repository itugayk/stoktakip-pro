import type { Prisma, Warehouse as PrismaWarehouse } from "@prisma/client";
import type { Warehouse } from "@/lib/types";

type WarehouseCreate = Prisma.WarehouseUncheckedCreateInput;

/**
 * Manager join via Prisma's `include: { manager: { select: { fullName } } }`.
 */
export type WarehouseJoinedRow = PrismaWarehouse & {
  manager?: { fullName: string } | null;
};

export function toWarehouse(
  row: WarehouseJoinedRow,
  stats?: { totalProducts: number; totalQuantity: number }
): Warehouse {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    managerId: row.managerId ?? undefined,
    managerName: row.manager?.fullName,
    isActive: row.isActive,
    totalProducts: stats?.totalProducts ?? 0,
    totalQuantity: stats?.totalQuantity ?? 0,
  };
}

export function fromWarehouse(
  w: Partial<Omit<Warehouse, "address" | "managerId">> & {
    companyId?: string;
    address?: string | null;
    managerId?: string | null;
  }
): Partial<WarehouseCreate> {
  const out: Partial<WarehouseCreate> = {};
  if (w.companyId !== undefined) out.companyId = w.companyId;
  if (w.name !== undefined) out.name = w.name;
  if (w.address !== undefined) out.address = w.address || null;
  if (w.managerId !== undefined) out.managerId = w.managerId || null;
  if (w.isActive !== undefined) out.isActive = w.isActive;
  return out;
}
