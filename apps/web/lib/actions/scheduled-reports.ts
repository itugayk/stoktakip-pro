"use server";

import { withAuth, withCompany, ok, parseInput, z, ERR } from "@/lib/server";

export type ReportType = "inventory" | "expiry" | "turnover" | "profit" | "sales_summary";
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
  reportType: z.enum(["inventory", "expiry", "turnover", "profit", "sales_summary"]),
  params: z.record(z.string(), z.unknown()).default({}),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  dayOfPeriod: z.number().int().min(0).max(31).optional(),
  hourOfDay: z.number().int().min(0).max(23).default(8),
  recipients: z.array(z.string().email("Geçersiz e-posta")).default([]),
  isActive: z.boolean().default(true),
});

/**
 * Compute the next-run timestamp from the schedule.
 * Local hour assumed in UTC for simplicity; in production the company's
 * timezone setting would map it.
 */
function nextRunFromSchedule(s: {
  frequency: Frequency;
  dayOfPeriod?: number;
  hourOfDay: number;
}): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCSeconds(0, 0);
  next.setUTCMinutes(0);
  next.setUTCHours(s.hourOfDay);

  if (s.frequency === "daily") {
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString();
  }
  if (s.frequency === "weekly") {
    const target = s.dayOfPeriod ?? 1; // Monday by default
    while (next.getUTCDay() !== target || next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next.toISOString();
  }
  // monthly
  const target = s.dayOfPeriod ?? 1;
  next.setUTCDate(Math.min(target, 28));
  if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString();
}

export const listScheduledReports = withAuth<void, ScheduledReport[]>(async (ctx) => {
  if (ctx.demo) return ok([]);

  const { data, error } = await ctx.supabase
    .from("scheduled_reports")
    .select("*")
    .order("name");
  if (error) throw ERR.database(error.message);

  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      reportType: r.report_type as ReportType,
      params: (r.params as Record<string, unknown>) ?? {},
      frequency: r.frequency as Frequency,
      dayOfPeriod: r.day_of_period ?? undefined,
      hourOfDay: Number(r.hour_of_day),
      recipients: r.recipients ?? [],
      isActive: r.is_active,
      lastRunAt: r.last_run_at ?? undefined,
      nextRunAt: r.next_run_at ?? undefined,
    }))
  );
});

export const upsertScheduledReport = withCompany<
  z.input<typeof upsertSchema>,
  { id: string }
>(async (ctx, raw) => {
  const data = parseInput(upsertSchema, raw);
  if (ctx.demo) return ok({ id: data.id ?? `sr-${Date.now()}` });

  const next_run_at = nextRunFromSchedule(data);
  const payload = {
    name: data.name,
    report_type: data.reportType,
    params: data.params,
    frequency: data.frequency,
    day_of_period: data.dayOfPeriod ?? null,
    hour_of_day: data.hourOfDay,
    recipients: data.recipients,
    is_active: data.isActive,
    next_run_at,
  };

  if (data.id) {
    const { error } = await ctx.supabase
      .from("scheduled_reports")
      .update(payload)
      .eq("id", data.id);
    if (error) throw ERR.database(error.message);
    return ok({ id: data.id });
  }

  const { data: row, error } = await ctx.supabase
    .from("scheduled_reports")
    .insert({ ...payload, company_id: ctx.companyId, created_by: ctx.userId } as never)
    .select("id")
    .single();
  if (error) throw ERR.database(error.message);
  return ok({ id: row.id });
});

export const deleteScheduledReport = withCompany<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase.from("scheduled_reports").delete().eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});
