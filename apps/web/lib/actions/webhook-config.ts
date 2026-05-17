"use server";

import { withCompany, withRole, ok, parseInput, z, ERR } from "@/lib/server";
import { randomSecret } from "@/lib/webhooks/sign";
import { WEBHOOK_EVENTS } from "@/lib/webhooks/events";

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  statusCode?: number;
  success: boolean;
  attempt: number;
  durationMs?: number;
  error?: string;
  createdAt: string;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Ad zorunlu"),
  url: z.string().url("Geçerli URL girin"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "En az bir olay seçin"),
  isActive: z.boolean().default(true),
});

export const listWebhooks = withCompany<void, Webhook[]>(async (ctx) => {
  if (ctx.demo) return ok([]);
  const { data, error } = await ctx.supabase
    .from("webhooks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw ERR.database(error.message);
  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      events: r.events,
      isActive: r.is_active,
      secret: r.secret,
      createdAt: r.created_at,
    }))
  );
});

export const upsertWebhook = withRole<z.input<typeof upsertSchema>, { id: string }>(
  ["admin"],
  async (ctx, raw) => {
    const data = parseInput(upsertSchema, raw);
    if (ctx.demo) return ok({ id: data.id ?? `wh-${Date.now()}` });

    const payload = {
      name: data.name,
      url: data.url,
      events: data.events,
      is_active: data.isActive,
    };

    if (data.id) {
      const { error } = await ctx.supabase.from("webhooks").update(payload).eq("id", data.id);
      if (error) throw ERR.database(error.message);
      return ok({ id: data.id });
    }
    const { data: row, error } = await ctx.supabase
      .from("webhooks")
      .insert({
        ...payload,
        company_id: ctx.companyId,
        secret: randomSecret(),
        created_by: ctx.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw ERR.database(error.message);
    return ok({ id: row.id });
  }
);

export const deleteWebhook = withRole<string, void>(["admin"], async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase.from("webhooks").delete().eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});

export const listWebhookDeliveries = withCompany<string, WebhookDelivery[]>(async (ctx, webhookId) => {
  if (ctx.demo) return ok([]);
  const { data, error } = await ctx.supabase
    .from("webhook_deliveries")
    .select("id, event, status_code, success, attempt, duration_ms, error, created_at")
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw ERR.database(error.message);
  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      event: r.event,
      statusCode: r.status_code ?? undefined,
      success: r.success,
      attempt: r.attempt,
      durationMs: r.duration_ms ?? undefined,
      error: r.error ?? undefined,
      createdAt: r.created_at,
    }))
  );
});

