/**
 * One-off maintenance: rebuild `inventory` from the full `stock_movements`
 * history. Use this once after deploying the FEFO stock engine if a company's
 * stock is inflated because pre-fix outbound movements never decremented stock.
 *
 * Strategy (per company, in a transaction):
 *   1) wipe inventory rows
 *   2) replay every movement in chronological order through the engine's
 *      lot-level helpers (NOT applyStockMovement — we must not write new
 *      movement rows)
 *   3) re-apply reservations for approved-but-unshipped sales orders
 *
 * Run with a live DB:  pnpm -C apps/web db:recompute
 * Optionally limit to one company:  pnpm -C apps/web db:recompute <companyId>
 */
import { PrismaClient } from "@prisma/client";
import {
  addOrMergeLot,
  consumeFEFO,
  transferStock,
  reserveFEFO,
} from "../lib/inventory/engine";

const prisma = new PrismaClient();

async function recomputeCompany(companyId: string): Promise<{ movements: number; reserved: number }> {
  return prisma.$transaction(
    async (tx) => {
      // 1) Wipe current inventory for this company.
      await tx.inventory.deleteMany({ where: { companyId } });

      // 2) Replay movements oldest-first.
      const movements = await tx.stockMovement.findMany({
        where: { companyId },
        orderBy: { createdAt: "asc" },
        select: {
          movementType: true,
          productId: true,
          quantity: true,
          fromWarehouseId: true,
          toWarehouseId: true,
          lotNumber: true,
          serialNumber: true,
          expiryDate: true,
          unitCost: true,
        },
      });

      for (const m of movements) {
        const qty = Number(m.quantity);
        if (qty <= 0) continue;
        const common = {
          companyId,
          productId: m.productId,
          lotNumber: m.lotNumber,
          serialNumber: m.serialNumber,
          expiryDate: m.expiryDate,
          unitCost: m.unitCost != null ? Number(m.unitCost) : 0,
        };

        switch (m.movementType) {
          case "in":
            if (m.toWarehouseId)
              await addOrMergeLot(tx, { ...common, warehouseId: m.toWarehouseId, quantity: qty });
            break;
          case "out":
            if (m.fromWarehouseId)
              await consumeFEFO(tx, {
                companyId, productId: m.productId, warehouseId: m.fromWarehouseId,
                quantity: qty, lotNumber: m.lotNumber, serialNumber: m.serialNumber,
                allowNegative: true,
              });
            break;
          case "transfer":
            if (m.fromWarehouseId && m.toWarehouseId)
              await transferStock(tx, {
                companyId, productId: m.productId,
                fromWarehouseId: m.fromWarehouseId, toWarehouseId: m.toWarehouseId,
                quantity: qty, lotNumber: m.lotNumber, allowNegative: true,
              });
            break;
          case "adjustment":
          case "return":
            if (m.toWarehouseId)
              await addOrMergeLot(tx, { ...common, warehouseId: m.toWarehouseId, quantity: qty });
            else if (m.fromWarehouseId)
              await consumeFEFO(tx, {
                companyId, productId: m.productId, warehouseId: m.fromWarehouseId,
                quantity: qty, lotNumber: m.lotNumber, serialNumber: m.serialNumber,
                allowNegative: true,
              });
            break;
        }
      }

      // 3) Re-apply reservations for approved (not yet shipped) sales orders.
      const approved = await tx.salesOrder.findMany({
        where: { companyId, status: "approved" },
        select: {
          warehouseId: true,
          items: { select: { productId: true, quantity: true } },
        },
      });
      let reserved = 0;
      for (const so of approved) {
        for (const it of so.items) {
          await reserveFEFO(tx, {
            companyId, productId: it.productId, warehouseId: so.warehouseId,
            quantity: Number(it.quantity), allowNegative: true,
          });
          reserved++;
        }
      }

      return { movements: movements.length, reserved };
    },
    { timeout: 120_000, maxWait: 10_000 }
  );
}

async function main() {
  const only = process.argv[2];
  const companies = only
    ? [{ id: only, name: only }]
    : await prisma.company.findMany({ select: { id: true, name: true } });

  console.log(`Recomputing inventory for ${companies.length} company(ies)…`);
  for (const c of companies) {
    try {
      const res = await recomputeCompany(c.id);
      console.log(`✓ ${c.name} (${c.id}): replayed ${res.movements} movements, re-reserved ${res.reserved} lines`);
    } catch (e) {
      console.error(`✗ ${c.name} (${c.id}):`, e instanceof Error ? e.message : e);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
