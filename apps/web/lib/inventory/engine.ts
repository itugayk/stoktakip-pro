import { Prisma } from "@prisma/client";

/**
 * Atomic, FEFO-based stock engine.
 *
 * Every inbound/outbound flow in the app routes through {@link applyStockMovement}
 * so that the `inventory` table is the single, always-correct source of truth for
 * "how much do we have". Before this engine existed, outbound flows only wrote an
 * audit row to `stock_movements` and never decremented `inventory.quantity`, so
 * stock could only ever go up (see plan / AUDIT).
 *
 * Concurrency: outbound consumption locks candidate lot rows with
 * `SELECT ... FOR UPDATE` inside the surrounding interactive transaction, which
 * serialises concurrent consumers on the same rows and closes the TOCTOU
 * (check-then-decrement) race that would otherwise allow overselling.
 *
 * All functions here MUST be called inside a `prisma.$transaction(async (tx) => …)`.
 */

export type Tx = Prisma.TransactionClient;

export type EngineMovementType =
  | "in"
  | "out"
  | "transfer"
  | "adjustment"
  | "return";

/** Thrown when an outbound movement would drive a product below zero. */
export class InsufficientStockError extends Error {
  readonly code = "insufficient_stock";
  constructor(
    readonly productId: string,
    readonly requested: number,
    readonly available: number,
    readonly warehouseId: string
  ) {
    super(
      `Yetersiz stok: ${requested} istendi, ${available} mevcut. ` +
        `Çıkış yapılamadı.`
    );
    this.name = "InsufficientStockError";
  }
}

function toDate(v?: string | Date | null): Date | null {
  if (!v) return null;
  return typeof v === "string" ? new Date(v) : v;
}

/** One lot's worth of consumed stock, returned so callers can compute COGS. */
export interface ConsumedLot {
  lotNumber: string | null;
  expiryDate: string | null;
  unitCost: number;
  quantity: number;
}

interface LotKey {
  companyId: string;
  productId: string;
  warehouseId: string;
  locationId?: string | null;
  lotNumber?: string | null;
  serialNumber?: string | null;
  expiryDate?: string | Date | null;
}

/**
 * Add stock to a lot, merging into an existing matching row when one exists so we
 * don't accumulate one row per receipt. Maintains a weighted-average unit cost.
 * A negative `quantity` decrements (used for allow-negative fallback).
 */
export async function addOrMergeLot(
  tx: Tx,
  args: LotKey & { quantity: number; unitCost?: number | null }
): Promise<void> {
  const expiry = toDate(args.expiryDate);
  const unitCost = Number(args.unitCost ?? 0);

  // Serial-tracked units are unique → never merge; always a fresh row.
  if (args.serialNumber) {
    await tx.inventory.create({
      data: {
        companyId: args.companyId,
        productId: args.productId,
        warehouseId: args.warehouseId,
        locationId: args.locationId ?? null,
        lotNumber: args.lotNumber ?? null,
        serialNumber: args.serialNumber,
        expiryDate: expiry,
        quantity: args.quantity,
        unitCost,
      },
    });
    return;
  }

  const existing = await tx.inventory.findFirst({
    where: {
      companyId: args.companyId,
      productId: args.productId,
      warehouseId: args.warehouseId,
      locationId: args.locationId ?? null,
      lotNumber: args.lotNumber ?? null,
      expiryDate: expiry,
    },
    select: { id: true, quantity: true, unitCost: true },
  });

  if (existing) {
    const oldQty = Number(existing.quantity);
    const oldCost = Number(existing.unitCost);
    const newQty = oldQty + args.quantity;
    // Weighted-average cost; only blend when adding stock with a known cost.
    const newCost =
      args.quantity > 0 && newQty > 0
        ? (oldQty * oldCost + args.quantity * unitCost) / newQty
        : oldCost;
    await tx.inventory.update({
      where: { id: existing.id },
      data: { quantity: newQty, unitCost: newCost },
    });
    return;
  }

  await tx.inventory.create({
    data: {
      companyId: args.companyId,
      productId: args.productId,
      warehouseId: args.warehouseId,
      locationId: args.locationId ?? null,
      lotNumber: args.lotNumber ?? null,
      expiryDate: expiry,
      quantity: args.quantity,
      unitCost,
    },
  });
}

interface LockRow {
  id: string;
  quantity: number;
  reservedQuantity: number;
  unitCost: number;
  lotNumber: string | null;
  expiryDate: string | null;
}

/**
 * Pure FEFO allocation: given lot rows already ordered oldest-expiry-first and
 * the available amount per row, decide how much to take from each. Returns the
 * per-row takes (in input order) and any unmet `shortfall`. No I/O — unit-tested
 * directly. Callers decide what to do with a shortfall (throw vs. allow-negative).
 */
export function planFEFO(
  rows: { available: number }[],
  requested: number
): { takes: number[]; shortfall: number } {
  const takes = new Array(rows.length).fill(0);
  let remaining = requested;
  for (let i = 0; i < rows.length && remaining > 0; i++) {
    const usable = rows[i].available;
    if (usable <= 0) continue;
    const take = Math.min(usable, remaining);
    takes[i] = take;
    remaining -= take;
  }
  return { takes, shortfall: remaining };
}

/**
 * Consume `quantity` of a product from a warehouse, oldest-expiry-first (FEFO).
 * Locks candidate rows FOR UPDATE. Throws {@link InsufficientStockError} when the
 * available quantity is short, unless `allowNegative` is set.
 */
export async function consumeFEFO(
  tx: Tx,
  args: {
    companyId: string;
    productId: string;
    warehouseId: string;
    quantity: number;
    lotNumber?: string | null;
    serialNumber?: string | null;
    allowNegative?: boolean;
  }
): Promise<ConsumedLot[]> {
  if (args.quantity <= 0) return [];

  const lotFilter = args.lotNumber
    ? Prisma.sql`AND lot_number = ${args.lotNumber}`
    : Prisma.empty;
  const serialFilter = args.serialNumber
    ? Prisma.sql`AND serial_number = ${args.serialNumber}`
    : Prisma.empty;

  const rows = await tx.$queryRaw<LockRow[]>(Prisma.sql`
    SELECT
      id::text AS id,
      quantity::float8 AS quantity,
      reserved_quantity::float8 AS "reservedQuantity",
      unit_cost::float8 AS "unitCost",
      lot_number AS "lotNumber",
      expiry_date::text AS "expiryDate"
    FROM inventory
    WHERE company_id = ${args.companyId}::uuid
      AND product_id = ${args.productId}::uuid
      AND warehouse_id = ${args.warehouseId}::uuid
      ${lotFilter}
      ${serialFilter}
      AND quantity > 0
    ORDER BY expiry_date ASC NULLS LAST, received_at ASC
    FOR UPDATE
  `);

  const available = rows.reduce(
    (sum, r) => sum + (r.quantity - r.reservedQuantity),
    0
  );

  if (available < args.quantity && !args.allowNegative) {
    throw new InsufficientStockError(
      args.productId,
      args.quantity,
      available,
      args.warehouseId
    );
  }

  const consumed: ConsumedLot[] = [];
  const { takes, shortfall } = planFEFO(
    rows.map((r) => ({ available: r.quantity - r.reservedQuantity })),
    args.quantity
  );

  for (let i = 0; i < rows.length; i++) {
    const take = takes[i];
    if (take <= 0) continue;
    const row = rows[i];
    await tx.$executeRaw(Prisma.sql`
      UPDATE inventory
      SET quantity = quantity - ${take}, updated_at = now()
      WHERE id = ${row.id}::uuid
    `);
    consumed.push({
      lotNumber: row.lotNumber,
      expiryDate: row.expiryDate,
      unitCost: row.unitCost,
      quantity: take,
    });
  }

  let remaining = shortfall;

  // allowNegative: absorb the shortfall by driving the newest row (or a fresh
  // row) negative so the books still balance.
  if (remaining > 0 && args.allowNegative) {
    await addOrMergeLot(tx, {
      companyId: args.companyId,
      productId: args.productId,
      warehouseId: args.warehouseId,
      lotNumber: args.lotNumber ?? null,
      quantity: -remaining,
      unitCost: rows[0]?.unitCost ?? 0,
    });
    consumed.push({
      lotNumber: args.lotNumber ?? null,
      expiryDate: null,
      unitCost: rows[0]?.unitCost ?? 0,
      quantity: remaining,
    });
    remaining = 0;
  }

  return consumed;
}

/**
 * Reserve `quantity` of a product against its FEFO lots (increments
 * `reserved_quantity`). Reserved stock stays physically present but is no longer
 * "available" to other orders. Throws {@link InsufficientStockError} when there
 * isn't enough free stock to reserve, unless `allowNegative` is set.
 *
 * Used when a sales order is approved so the goods are held for that customer.
 */
export async function reserveFEFO(
  tx: Tx,
  args: {
    companyId: string;
    productId: string;
    warehouseId: string;
    quantity: number;
    allowNegative?: boolean;
  }
): Promise<void> {
  if (args.quantity <= 0) return;

  const rows = await tx.$queryRaw<LockRow[]>(Prisma.sql`
    SELECT
      id::text AS id,
      quantity::float8 AS quantity,
      reserved_quantity::float8 AS "reservedQuantity",
      unit_cost::float8 AS "unitCost",
      lot_number AS "lotNumber",
      expiry_date::text AS "expiryDate"
    FROM inventory
    WHERE company_id = ${args.companyId}::uuid
      AND product_id = ${args.productId}::uuid
      AND warehouse_id = ${args.warehouseId}::uuid
      AND quantity > 0
    ORDER BY expiry_date ASC NULLS LAST, received_at ASC
    FOR UPDATE
  `);

  const available = rows.reduce(
    (sum, r) => sum + (r.quantity - r.reservedQuantity),
    0
  );
  if (available < args.quantity && !args.allowNegative) {
    throw new InsufficientStockError(
      args.productId,
      args.quantity,
      available,
      args.warehouseId
    );
  }

  const { takes, shortfall } = planFEFO(
    rows.map((r) => ({ available: r.quantity - r.reservedQuantity })),
    args.quantity
  );

  for (let i = 0; i < rows.length; i++) {
    if (takes[i] <= 0) continue;
    await tx.$executeRaw(Prisma.sql`
      UPDATE inventory
      SET reserved_quantity = reserved_quantity + ${takes[i]}, updated_at = now()
      WHERE id = ${rows[i].id}::uuid
    `);
  }

  // allowNegative over-reservation: pin the remainder on the first lot.
  if (shortfall > 0 && args.allowNegative && rows[0]) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE inventory
      SET reserved_quantity = reserved_quantity + ${shortfall}, updated_at = now()
      WHERE id = ${rows[0].id}::uuid
    `);
  }
}

/**
 * Release up to `quantity` of reserved stock (decrements `reserved_quantity`,
 * FEFO, clamped so it never goes below zero). Called when a reserved order ships
 * (right before consuming) or is cancelled. Never throws — releasing more than
 * is reserved is a no-op for the excess.
 */
export async function releaseReservation(
  tx: Tx,
  args: {
    companyId: string;
    productId: string;
    warehouseId: string;
    quantity: number;
  }
): Promise<void> {
  if (args.quantity <= 0) return;

  const rows = await tx.$queryRaw<LockRow[]>(Prisma.sql`
    SELECT id::text AS id, reserved_quantity::float8 AS "reservedQuantity"
    FROM inventory
    WHERE company_id = ${args.companyId}::uuid
      AND product_id = ${args.productId}::uuid
      AND warehouse_id = ${args.warehouseId}::uuid
      AND reserved_quantity > 0
    ORDER BY expiry_date ASC NULLS LAST, received_at ASC
    FOR UPDATE
  `);

  let remaining = args.quantity;
  for (const row of rows) {
    if (remaining <= 0) break;
    const release = Math.min(row.reservedQuantity, remaining);
    await tx.$executeRaw(Prisma.sql`
      UPDATE inventory
      SET reserved_quantity = reserved_quantity - ${release}, updated_at = now()
      WHERE id = ${row.id}::uuid
    `);
    remaining -= release;
  }
}

/** Move stock between warehouses FEFO, preserving lot/expiry/cost on the way in. */
export async function transferStock(
  tx: Tx,
  args: {
    companyId: string;
    productId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    quantity: number;
    lotNumber?: string | null;
    allowNegative?: boolean;
  }
): Promise<ConsumedLot[]> {
  const consumed = await consumeFEFO(tx, {
    companyId: args.companyId,
    productId: args.productId,
    warehouseId: args.fromWarehouseId,
    quantity: args.quantity,
    lotNumber: args.lotNumber,
    allowNegative: args.allowNegative,
  });

  for (const lot of consumed) {
    await addOrMergeLot(tx, {
      companyId: args.companyId,
      productId: args.productId,
      warehouseId: args.toWarehouseId,
      lotNumber: lot.lotNumber,
      expiryDate: lot.expiryDate,
      quantity: lot.quantity,
      unitCost: lot.unitCost,
    });
  }

  return consumed;
}

/**
 * Set a specific lot's quantity to an absolute value (physical-count
 * reconciliation). Returns the signed delta applied.
 */
export async function setLotQuantity(
  tx: Tx,
  args: LotKey & { newQuantity: number; unitCost?: number | null }
): Promise<number> {
  const expiry = toDate(args.expiryDate);
  const existing = await tx.inventory.findFirst({
    where: {
      companyId: args.companyId,
      productId: args.productId,
      warehouseId: args.warehouseId,
      lotNumber: args.lotNumber ?? null,
      expiryDate: expiry,
    },
    select: { id: true, quantity: true },
  });

  if (existing) {
    const delta = args.newQuantity - Number(existing.quantity);
    await tx.inventory.update({
      where: { id: existing.id },
      data: { quantity: args.newQuantity },
    });
    return delta;
  }

  if (args.newQuantity !== 0) {
    await tx.inventory.create({
      data: {
        companyId: args.companyId,
        productId: args.productId,
        warehouseId: args.warehouseId,
        lotNumber: args.lotNumber ?? null,
        expiryDate: expiry,
        quantity: args.newQuantity,
        unitCost: Number(args.unitCost ?? 0),
      },
    });
  }
  return args.newQuantity;
}

/**
 * Whether this company allows stock to go negative. Read from `company.settings`
 * JSON (`allow_negative_stock`), defaulting to `false` (the safe choice that
 * blocks overselling).
 */
export async function allowNegativeStock(
  tx: Tx,
  companyId: string
): Promise<boolean> {
  const company = await tx.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  const settings = company?.settings as { allow_negative_stock?: boolean } | null;
  return settings?.allow_negative_stock === true;
}

export interface MovementInput {
  companyId: string;
  productId: string;
  movementType: EngineMovementType;
  quantity: number; // always positive
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  locationId?: string | null;
  lotNumber?: string | null;
  serialNumber?: string | null;
  expiryDate?: string | Date | null;
  unitCost?: number | null;
  reason?: string | null;
  referenceType?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  userId: string;
  allowNegative?: boolean;
}

/**
 * THE single entry point for all stock changes. Applies the inventory effect for
 * the movement type AND writes the `stock_movements` audit row, atomically.
 */
export async function applyStockMovement(
  tx: Tx,
  input: MovementInput
): Promise<{ movementId: string; consumed: ConsumedLot[] }> {
  let consumed: ConsumedLot[] = [];

  switch (input.movementType) {
    case "in":
      await addOrMergeLot(tx, {
        companyId: input.companyId,
        productId: input.productId,
        warehouseId: requireWarehouse(input.toWarehouseId, "giriş hedefi"),
        locationId: input.locationId,
        lotNumber: input.lotNumber,
        serialNumber: input.serialNumber,
        expiryDate: input.expiryDate,
        quantity: input.quantity,
        unitCost: input.unitCost,
      });
      break;

    case "out":
      consumed = await consumeFEFO(tx, {
        companyId: input.companyId,
        productId: input.productId,
        warehouseId: requireWarehouse(input.fromWarehouseId, "çıkış kaynağı"),
        quantity: input.quantity,
        lotNumber: input.lotNumber,
        serialNumber: input.serialNumber,
        allowNegative: input.allowNegative,
      });
      break;

    case "transfer":
      consumed = await transferStock(tx, {
        companyId: input.companyId,
        productId: input.productId,
        fromWarehouseId: requireWarehouse(input.fromWarehouseId, "transfer kaynağı"),
        toWarehouseId: requireWarehouse(input.toWarehouseId, "transfer hedefi"),
        quantity: input.quantity,
        lotNumber: input.lotNumber,
        allowNegative: input.allowNegative,
      });
      break;

    case "adjustment":
    case "return":
      // Direction is implied by which warehouse is set.
      if (input.toWarehouseId) {
        await addOrMergeLot(tx, {
          companyId: input.companyId,
          productId: input.productId,
          warehouseId: input.toWarehouseId,
          locationId: input.locationId,
          lotNumber: input.lotNumber,
          expiryDate: input.expiryDate,
          quantity: input.quantity,
          unitCost: input.unitCost,
        });
      } else {
        consumed = await consumeFEFO(tx, {
          companyId: input.companyId,
          productId: input.productId,
          warehouseId: requireWarehouse(input.fromWarehouseId, "düzeltme kaynağı"),
          quantity: input.quantity,
          lotNumber: input.lotNumber,
          allowNegative: input.allowNegative,
        });
      }
      break;
  }

  // For outbound moves, record the weighted COGS we actually consumed.
  const cogs =
    consumed.length > 0
      ? consumed.reduce((s, l) => s + l.unitCost * l.quantity, 0) /
        consumed.reduce((s, l) => s + l.quantity, 0)
      : input.unitCost ?? null;

  const movement = await tx.stockMovement.create({
    data: {
      companyId: input.companyId,
      productId: input.productId,
      movementType: input.movementType,
      quantity: input.quantity,
      fromWarehouseId: input.fromWarehouseId ?? null,
      toWarehouseId: input.toWarehouseId ?? null,
      lotNumber: input.lotNumber ?? null,
      serialNumber: input.serialNumber ?? null,
      expiryDate: toDate(input.expiryDate),
      unitCost: cogs,
      reason: input.reason ?? null,
      referenceType: input.referenceType ?? null,
      referenceNumber: input.referenceNumber ?? null,
      notes: input.notes ?? null,
      userId: input.userId,
    },
    select: { id: true },
  });

  return { movementId: movement.id, consumed };
}

/** Thrown when a movement is missing a warehouse it needs. */
export class MovementConfigError extends Error {
  readonly code = "validation";
  constructor(message: string) {
    super(message);
    this.name = "MovementConfigError";
  }
}

function requireWarehouse(id: string | null | undefined, what: string): string {
  if (!id) throw new MovementConfigError(`Eksik depo: ${what} belirtilmedi`);
  return id;
}
