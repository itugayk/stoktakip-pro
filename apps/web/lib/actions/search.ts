"use server";

import { demoProducts, demoSuppliers, demoCustomers } from "@/lib/demo-data";
import type { ProductWithStock, Supplier, Customer } from "@/lib/types";
import { toProductWithStock, toSupplier, toCustomer } from "@/lib/mappers";
import { withAuth, ok, ERR } from "@/lib/server";

export interface SearchResults {
  products: ProductWithStock[];
  suppliers: Supplier[];
  customers: Customer[];
}

const LIMIT_PER_ENTITY = 5;

/**
 * Global search across products, suppliers, and customers.
 * Used by the header search input and the Cmd+K palette.
 *
 * NOTE: Postgres-side `pg_trgm` GIN indexes will be added in migration
 * `004_search_indexes.sql` (PHASES 1.3). Until then, plain ILIKE is used.
 */
export const searchEverything = withAuth<string, SearchResults>(async (ctx, q) => {
  const query = (q ?? "").trim();
  if (!query) return ok({ products: [], suppliers: [], customers: [] });

  if (ctx.demo) {
    const needle = query.toLowerCase();
    return ok({
      products: demoProducts
        .filter(
          (p) =>
            p.name.toLowerCase().includes(needle) ||
            p.sku.toLowerCase().includes(needle) ||
            p.barcode?.includes(query)
        )
        .slice(0, LIMIT_PER_ENTITY),
      suppliers: demoSuppliers
        .filter((s) => s.name.toLowerCase().includes(needle))
        .slice(0, LIMIT_PER_ENTITY),
      customers: demoCustomers
        .filter((c) => c.name.toLowerCase().includes(needle))
        .slice(0, LIMIT_PER_ENTITY),
    });
  }

  const escaped = query.replace(/[%_]/g, "\\$&");
  const like = `%${escaped}%`;

  const [products, suppliers, customers] = await Promise.all([
    ctx.supabase
      .from("product_stock_summary")
      .select("*")
      .or(`name.ilike.${like},sku.ilike.${like},barcode.ilike.${like}`)
      .limit(LIMIT_PER_ENTITY),
    ctx.supabase
      .from("suppliers")
      .select("*")
      .ilike("name", like)
      .limit(LIMIT_PER_ENTITY),
    ctx.supabase
      .from("customers")
      .select("*")
      .ilike("name", like)
      .limit(LIMIT_PER_ENTITY),
  ]);

  if (products.error) throw ERR.database(products.error.message);
  if (suppliers.error) throw ERR.database(suppliers.error.message);
  if (customers.error) throw ERR.database(customers.error.message);

  return ok({
    products: (products.data ?? []).map(toProductWithStock),
    suppliers: (suppliers.data ?? []).map((s) => toSupplier(s)),
    customers: (customers.data ?? []).map((c) => toCustomer(c)),
  });
});
