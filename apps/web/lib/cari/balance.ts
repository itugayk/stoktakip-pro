/**
 * Cari hesap (current account) balances — DERIVED, never denormalized.
 *
 * Single source of truth: orders + POS sales + payments. We never store a
 * running balance column (drift-free, matches the app's view/recompute style).
 *
 * Sign convention:
 *  - customer balance > 0  → customer owes us (alacak / receivable)
 *  - supplier balance > 0  → we owe the supplier (borç / payable)
 *
 * Only "committed" obligations count toward a balance (draft/pending/cancelled
 * excluded) so unconfirmed paperwork doesn't inflate what someone owes.
 */

import type { PrismaClient, Prisma } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** Sales-order statuses that represent a real obligation on the customer. */
export const SO_BILLED_STATUSES = ["approved", "shipped", "delivered"] as const;
/** Purchase-order statuses that represent a real obligation to the supplier. */
export const PO_BILLED_STATUSES = ["approved", "received", "partial"] as const;

export interface PartyBalances {
  /** customerId → balance (+ = customer owes us). */
  customers: Map<string, number>;
  /** supplierId → balance (+ = we owe supplier). */
  suppliers: Map<string, number>;
}

function add(map: Map<string, number>, key: string | null, value: number) {
  if (!key || value === 0) return;
  map.set(key, (map.get(key) ?? 0) + value);
}

/**
 * Compute every customer & supplier balance for a company in a handful of
 * grouped aggregates (no N+1). Reused by the customers/suppliers lists, the
 * accounts page and the P&L panel.
 */
export async function computePartyBalances(
  db: Db,
  companyId: string
): Promise<PartyBalances> {
  const [soAgg, saleAgg, poAgg, payInAgg, payOutAgg] = await Promise.all([
    db.salesOrder.groupBy({
      by: ["customerId"],
      where: { companyId, status: { in: [...SO_BILLED_STATUSES] } },
      _sum: { totalAmount: true },
    }),
    db.sale.groupBy({
      by: ["customerId"],
      where: { companyId, status: "completed", customerId: { not: null } },
      _sum: { totalAmount: true },
    }),
    db.purchaseOrder.groupBy({
      by: ["supplierId"],
      where: { companyId, status: { in: [...PO_BILLED_STATUSES] } },
      _sum: { totalAmount: true },
    }),
    db.payment.groupBy({
      by: ["customerId"],
      where: { companyId, direction: "inbound", customerId: { not: null } },
      _sum: { amount: true },
    }),
    db.payment.groupBy({
      by: ["supplierId"],
      where: { companyId, direction: "outbound", supplierId: { not: null } },
      _sum: { amount: true },
    }),
  ]);

  const customers = new Map<string, number>();
  for (const r of soAgg) add(customers, r.customerId, Number(r._sum.totalAmount ?? 0));
  for (const r of saleAgg) add(customers, r.customerId, Number(r._sum.totalAmount ?? 0));
  for (const r of payInAgg) add(customers, r.customerId, -Number(r._sum.amount ?? 0));

  const suppliers = new Map<string, number>();
  for (const r of poAgg) add(suppliers, r.supplierId, Number(r._sum.totalAmount ?? 0));
  for (const r of payOutAgg) add(suppliers, r.supplierId, -Number(r._sum.amount ?? 0));

  return { customers, suppliers };
}

/** Current balance for one customer (+ = owes us). */
export async function customerBalance(
  db: Db,
  companyId: string,
  customerId: string
): Promise<number> {
  const [so, sale, payIn] = await Promise.all([
    db.salesOrder.aggregate({
      where: { companyId, customerId, status: { in: [...SO_BILLED_STATUSES] } },
      _sum: { totalAmount: true },
    }),
    db.sale.aggregate({
      where: { companyId, customerId, status: "completed" },
      _sum: { totalAmount: true },
    }),
    db.payment.aggregate({
      where: { companyId, customerId, direction: "inbound" },
      _sum: { amount: true },
    }),
  ]);
  return (
    Number(so._sum.totalAmount ?? 0) +
    Number(sale._sum.totalAmount ?? 0) -
    Number(payIn._sum.amount ?? 0)
  );
}
