"use server";

import { withAuth, withCompany, ok, parseInput, z, ERR } from "@/lib/server";

export type ReportType =
  | "inventory"
  | "expiry"
  | "turnover"
  | "profit"
  | "sales_summary";
export type Frequency = "daily" | "weekly" | "monthly";

export interface ScheduledReport {
  id: string;
  name: string;
  reportType: ReportType;
  params: Record<string, unknown>;
  frequency: Frequency;
  dayOfPeriod?: number;
  hourOfDay: number;
  recipients: string[];
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Ad zorunlu"),
  reportType: z.enum([
    "inventory",
    "expiry",
    "turnover",
    "profit",
    "sales_summary",
  ]),
  params: z.record(z.string(), z.unknown()).default({}),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  dayOfPeriod: z.number().int().min(0).max(31).optional(),
  hourOfDay: z.number().int().min(0).max(23).default(8),
  recipients: z.array(z.string().email("Geçersiz e-posta")).default([]),
  isActive: z.boolean().default(true),
});

/**
 * Compute the next-run timestamp from the schedule.
 * Local hour assumed in UTC for simplicity.
 */
function nextRunFromSchedule(s: {
  frequency: Frequency;
  dayOfPeriod?: number;
  hourOfDay: number;
}): Date {
  const now = new Date();
  const next = new Date(now);
  next.setUTCSeconds(0, 0);
  next.setUTCMinutes(0);
  next.setUTCHours(s.hourOfDay);

  if (s.frequency === "daily") {
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  if (s.frequency === "weekly") {
    const target = s.dayOfPeriod ?? 1; // Monday by default
    while (next.getUTCDay() !== target || next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }
  // monthly
  const target = s.dayOfPeriod ?? 1;
  next.setUTCDate(Math.min(target, 28));
  if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export const listScheduledReports = withAuth<void, ScheduledReport[]>(
  async (ctx) => {
    const rows = await ctx.prisma.scheduledReport.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { name: "asc" },
    });

    return ok(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        reportType: r.reportType as ReportType,
        params: (r.params as Record<string, unknown>) ?? {},
        frequency: r.frequency as Frequency,
        dayOfPeriod: r.dayOfPeriod ?? undefined,
        hourOfDay: Number(r.hourOfDay),
        recipients: r.recipients ?? [],
        isActive: r.isActive,
        lastRunAt: r.lastRunAt?.toISOString() ?? undefined,
        nextRunAt: r.nextRunAt?.toISOString() ?? undefined,
      }))
    );
  }
);

export const upsertScheduledReport = withCompany<
  z.input<typeof upsertSchema>,
  { id: string }
>(async (ctx, raw) => {
  const data = parseInput(upsertSchema, raw);

  const nextRunAt = nextRunFromSchedule(data);
  const payload = {
    name: data.name,
    reportType: data.reportType,
    params: data.params as never,
    frequency: data.frequency,
    dayOfPeriod: data.dayOfPeriod ?? null,
    hourOfDay: data.hourOfDay,
    recipients: data.recipients,
    isActive: data.isActive,
    nextRunAt,
  };

  if (data.id) {
    const exists = await ctx.prisma.scheduledReport.findFirst({
      where: { id: data.id, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!exists) throw ERR.notFound("Zamanlanmış rapor");

    await ctx.prisma.scheduledReport.update({
      where: { id: data.id },
      data: payload,
    });
    return ok({ id: data.id });
  }

  const row = await ctx.prisma.scheduledReport.create({
    data: {
      ...payload,
      companyId: ctx.companyId,
      createdById: ctx.userId,
    },
    select: { id: true },
  });
  return ok({ id: row.id });
});

export const deleteScheduledReport = withCompany<string, void>(
  async (ctx, id) => {
    const res = await ctx.prisma.scheduledReport.deleteMany({
      where: { id, companyId: ctx.companyId },
    });
    if (res.count === 0) throw ERR.notFound("Zamanlanmış rapor");
    return ok();
  }
);
