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
  if (ctx.demo) return ok([]);

  let q = ctx.supabase
    .from("order_templates")
    .select("*")
    .order("name");
  if (filter?.type) q = q.eq("type", filter.type);

  const { data, error } = await q;
  if (error) throw ERR.database(error.message);

  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type as OrderTemplateType,
      partnerId: r.partner_id ?? undefined,
      items: (r.items as { productId: string; quantity: number; unitPrice: number }[]) ?? [],
      notes: r.notes ?? undefined,
      createdAt: r.created_at,
    }))
  );
});

export const upsertOrderTemplate = withCompany<z.input<typeof upsertSchema>, { id: string }>(
  async (ctx, raw) => {
    const data = parseInput(upsertSchema, raw);
    if (ctx.demo) return ok({ id: data.id ?? `tpl-${Date.now()}` });

    const payload = {
      name: data.name,
      type: data.type,
      partner_id: data.partnerId ?? null,
      items: data.items,
      notes: data.notes ?? null,
    };

    if (data.id) {
      const { error } = await ctx.supabase
        .from("order_templates")
        .update(payload)
        .eq("id", data.id);
      if (error) throw ERR.database(error.message);
      return ok({ id: data.id });
    }

    const { data: row, error } = await ctx.supabase
      .from("order_templates")
      .insert({ ...payload, company_id: ctx.companyId, created_by: ctx.userId } as never)
      .select("id")
      .single();
    if (error) throw ERR.database(error.message);
    return ok({ id: row.id });
  }
);

export const deleteOrderTemplate = withCompany<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase.from("order_templates").delete().eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});
