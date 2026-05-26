import type { Prisma, StockMovement as PrismaStockMovement } from "@prisma/client";
import type { StockMovement, MovementType } from "@/lib/types";

type MovementCreate = Prisma.StockMovementUncheckedCreateInput;

/**
 * Joined row shape used by getStockMovements queries via Prisma `include`.
 */
export type MovementJoinedRow = PrismaStockMovement & {
  product?: { name: string; sku: string } | null;
  fromWarehouse?: { name: string } | null;
  toWarehouse?: { name: string } | null;
  user?: { fullName: string } | null;
};

const d = (v: Prisma.Decimal | number | string): number =>
  typeof v === "number" ? v : Number(v);

const iso = (v: Date | string): string =>
  typeof v === "string" ? v : v.toISOString();

const isoDate = (v: Date | string | null | undefined): string | undefined => {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  return v.toISOString().slice(0, 10);
};

export function toStockMovement(row: MovementJoinedRow): StockMovement {
  const fromWh = row.fromWarehouse;
  const toWh = row.toWarehouse;
  return {
    id: row.id,
    productId: row.productId,
    productName: row.product?.name ?? "",
    productSku: row.product?.sku ?? "",
    type: row.movementType as MovementType,
    quantity: d(row.quantity),
    warehouseId: row.fromWarehouseId ?? row.toWarehouseId ?? "",
    warehouseName: fromWh?.name ?? toWh?.name ?? "",
    toWarehouseId: row.toWarehouseId ?? undefined,
    toWarehouseName: toWh?.name,
    lotNumber: row.lotNumber ?? undefined,
    expiryDate: isoDate(row.expiryDate),
    reason: row.reason ?? undefined,
    reference: row.referenceNumber ?? undefined,
    userId: row.userId,
    userName: row.user?.fullName ?? "",
    createdAt: iso(row.createdAt),
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
): Partial<MovementCreate> {
  const out: Partial<MovementCreate> = {};
  if (m.companyId !== undefined) out.companyId = m.companyId;
  if (m.productId !== undefined) out.productId = m.productId;
  if (m.type !== undefined) out.movementType = m.type;
  if (m.quantity !== undefined) out.quantity = m.quantity;
  if (m.fromWarehouseId !== undefined) out.fromWarehouseId = m.fromWarehouseId || null;
  if (m.toWarehouseId !== undefined) out.toWarehouseId = m.toWarehouseId || null;
  if (m.lotNumber !== undefined) out.lotNumber = m.lotNumber || null;
  if (m.expiryDate !== undefined) out.expiryDate = m.expiryDate || null;
  if (m.unitCost !== undefined) out.unitCost = m.unitCost;
  if (m.reason !== undefined) out.reason = m.reason || null;
  if (m.reference !== undefined) out.referenceNumber = m.reference || null;
  if (m.referenceType !== undefined) out.referenceType = m.referenceType;
  if (m.notes !== undefined) out.notes = m.notes;
  if (m.userId !== undefined) out.userId = m.userId;
  return out;
}
