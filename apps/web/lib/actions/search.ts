"use server";

import type { ProductWithStock, Supplier, Customer } from "@/lib/types";
import { toProductWithStock, toSupplier, toCustomer } from "@/lib/mappers";
import { withAuth, ok } from "@/lib/server";

export interface SearchResults {
  products: ProductWithStock[];
  suppliers: Supplier[];
  customers: Customer[];
}

const LIMIT_PER_ENTITY = 5;

/**
 * Global search across products, suppliers, and customers.
 * Used by the header search input and the Cmd+K palette.
 */
export const searchEverything = withAuth<string, SearchResults>(
  async (ctx, q) => {
    const query = (q ?? "").trim();
    if (!query) return ok({ products: [], suppliers: [], customers: [] });

    const [products, suppliers, customers] = await Promise.all([
      ctx.prisma.productStockSummary.findMany({
        where: {
          companyId: ctx.companyId,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
            { barcode: { contains: query, mode: "insensitive" } },
          ],
        },
        take: LIMIT_PER_ENTITY,
      }),
      ctx.prisma.supplier.findMany({
        where: {
          companyId: ctx.companyId,
          name: { contains: query, mode: "insensitive" },
        },
        take: LIMIT_PER_ENTITY,
      }),
      ctx.prisma.customer.findMany({
        where: {
          companyId: ctx.companyId,
          name: { contains: query, mode: "insensitive" },
        },
        take: LIMIT_PER_ENTITY,
      }),
    ]);

    return ok({
      products: products.map(toProductWithStock),
      suppliers: suppliers.map((s) => toSupplier(s)),
      customers: customers.map((c) => toCustomer(c)),
    });
  }
);
