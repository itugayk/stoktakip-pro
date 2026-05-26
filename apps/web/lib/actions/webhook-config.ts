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
  const rows = await ctx.prisma.webhook.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      events: r.events,
      isActive: r.isActive,
      secret: r.secret,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

export const upsertWebhook = withRole<
  z.input<typeof upsertSchema>,
  { id: string }
>(["admin"], async (ctx, raw) => {
  const data = parseInput(upsertSchema, raw);

  if (data.id) {
    const exists = await ctx.prisma.webhook.findFirst({
      where: { id: data.id, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!exists) throw ERR.notFound("Webhook");

    await ctx.prisma.webhook.update({
      where: { id: data.id },
      data: {
        name: data.name,
        url: data.url,
        events: data.events,
        isActive: data.isActive,
      },
    });
    return ok({ id: data.id });
  }

  const row = await ctx.prisma.webhook.create({
    data: {
      companyId: ctx.companyId,
      name: data.name,
      url: data.url,
      events: data.events,
      isActive: data.isActive,
      secret: randomSecret(),
      createdById: ctx.userId,
    },
    select: { id: true },
  });
  return ok({ id: row.id });
});

export const deleteWebhook = withRole<string, void>(["admin"], async (ctx, id) => {
  const res = await ctx.prisma.webhook.deleteMany({
    where: { id, companyId: ctx.companyId },
  });
  if (res.count === 0) throw ERR.notFound("Webhook");
  return ok();
});

export const listWebhookDeliveries = withCompany<string, WebhookDelivery[]>(
  async (ctx, webhookId) => {
    const rows = await ctx.prisma.webhookDelivery.findMany({
      where: { webhookId, companyId: ctx.companyId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return ok(
      rows.map((r) => ({
        id: r.id,
        event: r.event,
        statusCode: r.statusCode ?? undefined,
        success: r.success,
        attempt: r.attempt,
        durationMs: r.durationMs ?? undefined,
        error: r.error ?? undefined,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  }
);
