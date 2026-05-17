"use server";

import { withCompany, withRole, ok, parseInput, z, ERR } from "@/lib/server";

/**
 * KVKK compliance — bulk export of all company-owned data as JSON. The UI
 * triggers this, then writes the file via xlsx on the client side. We return
 * structured data here so the server only does the read; rendering is the
 * client's job.
 */

export interface DataExport {
  exportedAt: string;
  company: Record<string, unknown> | null;
  products: Record<string, unknown>[];
  inventory: Record<string, unknown>[];
  stockMovements: Record<string, unknown>[];
  warehouses: Record<string, unknown>[];
  suppliers: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  purchaseOrders: Record<string, unknown>[];
  salesOrders: Record<string, unknown>[];
}

export const exportCompanyData = withRole<void, DataExport>(["admin"], async (ctx) => {
  if (ctx.demo) {
    return ok({
      exportedAt: new Date().toISOString(),
      company: { name: "Demo Şirketi" },
      products: [],
      inventory: [],
      stockMovements: [],
      warehouses: [],
      suppliers: [],
      customers: [],
      purchaseOrders: [],
      salesOrders: [],
    });
  }

  const tables = [
    "products",
    "inventory",
    "stock_movements",
    "warehouses",
    "suppliers",
    "customers",
    "purchase_orders",
    "sales_orders",
  ] as const;

  const [company, ...results] = await Promise.all([
    ctx.supabase.from("companies").select("*").eq("id", ctx.companyId).single(),
    ...tables.map((t) =>
      ctx.supabase.from(t).select("*").eq("company_id", ctx.companyId).limit(50000)
    ),
  ]);

  for (const r of results) {
    if (r.error) throw ERR.database(r.error.message);
  }

  return ok({
    exportedAt: new Date().toISOString(),
    company: (company.data as Record<string, unknown> | null) ?? null,
    products: results[0].data ?? [],
    inventory: results[1].data ?? [],
    stockMovements: results[2].data ?? [],
    warehouses: results[3].data ?? [],
    suppliers: results[4].data ?? [],
    customers: results[5].data ?? [],
    purchaseOrders: results[6].data ?? [],
    salesOrders: results[7].data ?? [],
  });
});

const deleteSchema = z.object({
  /** Belirsiz silmeyi önlemek için kullanıcıdan tam şirket adını isteriz. */
  confirmCompanyName: z.string().min(1),
});

export const requestCompanyDeletion = withRole<z.input<typeof deleteSchema>, { scheduled: boolean }>(
  ["admin"],
  async (ctx, raw) => {
    const data = parseInput(deleteSchema, raw);
    if (ctx.demo) return ok({ scheduled: true });

    const { data: company } = await ctx.supabase
      .from("companies")
      .select("name")
      .eq("id", ctx.companyId)
      .single();
    if (!company) throw ERR.notFound("Şirket");
    if (company.name !== data.confirmCompanyName) {
      throw ERR.validation("Şirket adı eşleşmedi");
    }

    // Mark for deletion — actual cascade happens in a follow-up job after a
    // 30-day grace period. We embed the marker in `settings` rather than
    // adding a new column.
    const { data: existing } = await ctx.supabase
      .from("companies")
      .select("settings")
      .eq("id", ctx.companyId)
      .single();
    const settings = (existing?.settings as Record<string, unknown> | null) ?? {};
    settings.scheduledDeletionAt = new Date(Date.now() + 30 * 86400000).toISOString();

    const { error } = await ctx.supabase
      .from("companies")
      .update({ settings, is_active: false })
      .eq("id", ctx.companyId);
    if (error) throw ERR.database(error.message);

    return ok({ scheduled: true });
  }
);
