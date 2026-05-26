"use server";

import { withAuth, withCompany, ok, parseInput, z, ERR } from "@/lib/server";

export type OrderTemplateType = "purchase" | "sales";

export interface OrderTemplate {
  id: string;
  name: string;
  type: OrderTemplateType;
  partnerId?: string;
  items: { productId: string; quantity: number; unitPrice: number }[];
  notes?: string;
  createdAt: string;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Şablon adı zorunlu"),
  type: z.enum(["purchase", "sales"]),
  partnerId: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1, "En az bir kalem"),
});

export const listOrderTemplates = withAuth<
  { type?: OrderTemplateType } | undefined,
  OrderTemplate[]
>(async (ctx, filter) => {
  const rows = await ctx.prisma.orderTemplate.findMany({
    where: {
      companyId: ctx.companyId,
      ...(filter?.type ? { type: filter.type } : {}),
    },
    orderBy: { name: "asc" },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type as OrderTemplateType,
      partnerId: r.partnerId ?? undefined,
      items:
        (r.items as { productId: string; quantity: number; unitPrice: number }[]) ??
        [],
      notes: r.notes ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

export const upsertOrderTemplate = withCompany<
  z.input<typeof upsertSchema>,
  { id: string }
>(async (ctx, raw) => {
  const data = parseInput(upsertSchema, raw);

  const payload = {
    name: data.name,
    type: data.type,
    partnerId: data.partnerId ?? null,
    items: data.items,
    notes: data.notes ?? null,
  };

  if (data.id) {
    const exists = await ctx.prisma.orderTemplate.findFirst({
      where: { id: data.id, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!exists) throw ERR.notFound("Şablon");

    await ctx.prisma.orderTemplate.update({
      where: { id: data.id },
      data: payload,
    });
    return ok({ id: data.id });
  }

  const row = await ctx.prisma.orderTemplate.create({
    data: {
      ...payload,
      companyId: ctx.companyId,
      createdById: ctx.userId,
    },
    select: { id: true },
  });
  return ok({ id: row.id });
});

export const deleteOrderTemplate = withCompany<string, void>(async (ctx, id) => {
  const res = await ctx.prisma.orderTemplate.deleteMany({
    where: { id, companyId: ctx.companyId },
  });
  if (res.count === 0) throw ERR.notFound("Şablon");
  return ok();
});
