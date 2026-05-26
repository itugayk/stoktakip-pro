"use server";

import { withRole, ok, parseInput, z, ERR } from "@/lib/server";

/**
 * KVKK compliance — bulk export of all company-owned data. The UI triggers
 * this, then writes the file via xlsx on the client side. We return structured
 * data here so the server only does the read; rendering is the client's job.
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

export const exportCompanyData = withRole<void, DataExport>(
  ["admin"],
  async (ctx) => {
    const where = { companyId: ctx.companyId };
    const limit = 50000;

    const [
      company,
      products,
      inventory,
      stockMovements,
      warehouses,
      suppliers,
      customers,
      purchaseOrders,
      salesOrders,
    ] = await Promise.all([
      ctx.prisma.company.findUnique({ where: { id: ctx.companyId } }),
      ctx.prisma.product.findMany({ where, take: limit }),
      ctx.prisma.inventory.findMany({ where, take: limit }),
      ctx.prisma.stockMovement.findMany({ where, take: limit }),
      ctx.prisma.warehouse.findMany({ where, take: limit }),
      ctx.prisma.supplier.findMany({ where, take: limit }),
      ctx.prisma.customer.findMany({ where, take: limit }),
      ctx.prisma.purchaseOrder.findMany({ where, take: limit }),
      ctx.prisma.salesOrder.findMany({ where, take: limit }),
    ]);

    return ok({
      exportedAt: new Date().toISOString(),
      company: (company as unknown as Record<string, unknown>) ?? null,
      products: products as unknown as Record<string, unknown>[],
      inventory: inventory as unknown as Record<string, unknown>[],
      stockMovements: stockMovements as unknown as Record<string, unknown>[],
      warehouses: warehouses as unknown as Record<string, unknown>[],
      suppliers: suppliers as unknown as Record<string, unknown>[],
      customers: customers as unknown as Record<string, unknown>[],
      purchaseOrders: purchaseOrders as unknown as Record<string, unknown>[],
      salesOrders: salesOrders as unknown as Record<string, unknown>[],
    });
  }
);

const deleteSchema = z.object({
  /** Belirsiz silmeyi önlemek için kullanıcıdan tam şirket adını isteriz. */
  confirmCompanyName: z.string().min(1),
});

export const requestCompanyDeletion = withRole<
  z.input<typeof deleteSchema>,
  { scheduled: boolean }
>(["admin"], async (ctx, raw) => {
  const data = parseInput(deleteSchema, raw);

  const company = await ctx.prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: { name: true, settings: true },
  });
  if (!company) throw ERR.notFound("Şirket");
  if (company.name !== data.confirmCompanyName) {
    throw ERR.validation("Şirket adı eşleşmedi");
  }

  // Mark for deletion — actual cascade happens in a follow-up job after a
  // 30-day grace period. We embed the marker in `settings`.
  const settings =
    ((company.settings as Record<string, unknown> | null) ?? {});
  settings.scheduledDeletionAt = new Date(
    Date.now() + 30 * 86400000
  ).toISOString();

  await ctx.prisma.company.update({
    where: { id: ctx.companyId },
    data: { settings: settings as never, isActive: false },
  });

  return ok({ scheduled: true });
});
