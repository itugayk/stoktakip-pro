import type { Prisma, Inventory as PrismaInventory } from "@prisma/client";
import type { InventoryLot } from "@/lib/types";

type InventoryCreate = Prisma.InventoryUncheckedCreateInput;

/**
 * View row for expiring_lots includes derived `days_left` and joined names.
 * Prisma's `view` block emits this as ExpiringLot type.
 */
type ExpiringLotRow = Prisma.ExpiringLotGetPayload<Record<string, never>>;

export interface ExpiringLot extends InventoryLot {
  productSku?: string;
  daysLeft: number;
}

const d = (v: Prisma.Decimal | number | string): number =>
  typeof v === "number" ? v : Number(v);

const iso = (v: Date | string): string =>
  typeof v === "string" ? v : v.toISOString();

const isoDate = (v: Date | string | null | undefined): string | undefined => {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  return v.toISOString().slice(0, 10);
};

export function toInventoryLot(
  row: PrismaInventory,
  joined?: { productName?: string; warehouseName?: string }
): InventoryLot {
  return {
    id: row.id,
    productId: row.productId,
    productName: joined?.productName ?? "",
    lotNumber: row.lotNumber ?? "",
    quantity: d(row.quantity),
    expiryDate: isoDate(row.expiryDate),
    warehouseId: row.warehouseId,
    warehouseName: joined?.warehouseName ?? "",
    receivedAt: iso(row.receivedAt),
  };
}

export function fromInventoryLot(
  lot: Partial<InventoryLot> & {
    companyId?: string;
    locationId?: string;
    unitCost?: number;
    reservedQuantity?: number;
  }
): Partial<InventoryCreate> {
  const out: Partial<InventoryCreate> = {};
  if (lot.companyId !== undefined) out.companyId = lot.companyId;
  if (lot.productId !== undefined) out.productId = lot.productId;
  if (lot.warehouseId !== undefined) out.warehouseId = lot.warehouseId;
  if (lot.locationId !== undefined) out.locationId = lot.locationId || null;
  if (lot.lotNumber !== undefined) out.lotNumber = lot.lotNumber || null;
  if (lot.expiryDate !== undefined) out.expiryDate = lot.expiryDate || null;
  if (lot.quantity !== undefined) out.quantity = lot.quantity;
  if (lot.reservedQuantity !== undefined) out.reservedQuantity = lot.reservedQuantity;
  if (lot.unitCost !== undefined) out.unitCost = lot.unitCost;
  return out;
}

export function toExpiringLot(row: ExpiringLotRow): ExpiringLot {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    productSku: row.productSku,
    lotNumber: row.lotNumber ?? "",
    quantity: d(row.quantity),
    expiryDate: isoDate(row.expiryDate)!,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    receivedAt: iso(row.receivedAt),
    daysLeft: row.daysLeft,
  };
}
