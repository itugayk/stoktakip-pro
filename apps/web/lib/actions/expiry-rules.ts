"use server";

import { withAuth, withCompany, ok, parseInput, z, ERR } from "@/lib/server";

export type Channel = "in_app" | "email" | "push" | "whatsapp";

export interface ExpiryRule {
  id: string;
  name: string;
  triggerDays: number;
  categoryId?: string;
  channels: Channel[];
  recipients?: string[];
  isActive: boolean;
  lastRunAt?: string;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Kural adı zorunlu"),
  triggerDays: z.number().int().positive(),
  categoryId: z.string().optional(),
  channels: z.array(z.enum(["in_app", "email", "push", "whatsapp"])).min(1),
  recipients: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export const listExpiryRules = withAuth<void, ExpiryRule[]>(async (ctx) => {
  if (ctx.demo) return ok([]);

  const { data, error } = await ctx.supabase
    .from("expiry_rules")
    .select("*")
    .order("trigger_days");
  if (error) throw ERR.database(error.message);

  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      triggerDays: r.trigger_days,
      categoryId: r.category_id ?? undefined,
      channels: (r.channels ?? []) as Channel[],
      recipients: r.recipients ?? undefined,
      isActive: r.is_active,
      lastRunAt: r.last_run_at ?? undefined,
    }))
  );
});

export const upsertExpiryRule = withCompany<z.input<typeof upsertSchema>, { id: string }>(
  async (ctx, raw) => {
    const data = parseInput(upsertSchema, raw);
    if (ctx.demo) return ok({ id: data.id ?? `rule-${Date.now()}` });

    if (data.id) {
      const { error } = await ctx.supabase
        .from("expiry_rules")
        .update({
          name: data.name,
          trigger_days: data.triggerDays,
          category_id: data.categoryId || null,
          channels: data.channels,
          recipients: data.recipients ?? null,
          is_active: data.isActive,
        })
        .eq("id", data.id);
      if (error) throw ERR.database(error.message);
      return ok({ id: data.id });
    }

    const { data: row, error } = await ctx.supabase
      .from("expiry_rules")
      .insert({
        company_id: ctx.companyId,
        name: data.name,
        trigger_days: data.triggerDays,
        category_id: data.categoryId || null,
        channels: data.channels,
        recipients: data.recipients ?? null,
        is_active: data.isActive,
      } as never)
      .select("id")
      .single();
    if (error) throw ERR.database(error.message);
    return ok({ id: row.id });
  }
);

export const deleteExpiryRule = withCompany<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase.from("expiry_rules").delete().eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});

/**
 * Manually fire the rule engine. Useful for "Run now" buttons; the real
 * schedule is the daily Postgres cron.
 */
export const runExpiryRulesNow = withCompany<void, { fired: number }>(async (ctx) => {
  if (ctx.demo) return ok({ fired: 0 });
  const { data, error } = await ctx.supabase.rpc("run_expiry_rules");
  if (error) throw ERR.database(error.message);
  return ok({ fired: Number(data ?? 0) });
});
