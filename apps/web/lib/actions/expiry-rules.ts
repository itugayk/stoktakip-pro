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
  const rows = await ctx.prisma.expiryRule.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { triggerDays: "asc" },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      triggerDays: r.triggerDays,
      categoryId: r.categoryId ?? undefined,
      channels: (r.channels ?? []) as Channel[],
      recipients: r.recipients?.length ? r.recipients : undefined,
      isActive: r.isActive,
      lastRunAt: r.lastRunAt?.toISOString() ?? undefined,
    }))
  );
});

export const upsertExpiryRule = withCompany<
  z.input<typeof upsertSchema>,
  { id: string }
>(async (ctx, raw) => {
  const data = parseInput(upsertSchema, raw);

  const payload = {
    name: data.name,
    triggerDays: data.triggerDays,
    categoryId: data.categoryId || null,
    channels: data.channels,
    recipients: data.recipients ?? [],
    isActive: data.isActive,
  };

  if (data.id) {
    const exists = await ctx.prisma.expiryRule.findFirst({
      where: { id: data.id, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!exists) throw ERR.notFound("Kural");

    await ctx.prisma.expiryRule.update({
      where: { id: data.id },
      data: payload,
    });
    return ok({ id: data.id });
  }

  const row = await ctx.prisma.expiryRule.create({
    data: { ...payload, companyId: ctx.companyId },
    select: { id: true },
  });
  return ok({ id: row.id });
});

export const deleteExpiryRule = withCompany<string, void>(async (ctx, id) => {
  const res = await ctx.prisma.expiryRule.deleteMany({
    where: { id, companyId: ctx.companyId },
  });
  if (res.count === 0) throw ERR.notFound("Kural");
  return ok();
});

/**
 * Manually fire the rule engine. The real schedule is the daily Postgres cron.
 * The function `run_expiry_rules()` ships via `prisma/sql/03_run_expiry_rules.sql`.
 */
export const runExpiryRulesNow = withCompany<void, { fired: number }>(
  async (ctx) => {
    const result = await ctx.prisma.$queryRaw<{ run_expiry_rules: number }[]>`
      SELECT run_expiry_rules() AS run_expiry_rules
    `;
    return ok({ fired: Number(result[0]?.run_expiry_rules ?? 0) });
  }
);
