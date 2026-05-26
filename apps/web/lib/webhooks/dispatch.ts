"use server";

import { sign } from "./sign";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";

/**
 * Outbound webhook dispatcher.
 *
 * Call `fireWebhookEvent(companyId, event, payload)` after a domain action.
 * The function loads all active webhooks subscribed to the event, signs each
 * delivery, and writes a row to webhook_deliveries with the result. Failures
 * do not throw — webhooks are best-effort by design.
 */

export type WebhookEvent =
  | "product.created"
  | "product.updated"
  | "product.deleted"
  | "stock.low"
  | "stock.movement"
  | "order.created"
  | "order.approved"
  | "order.shipped"
  | "order.received"
  | "count.closed"
  | "return.created"
  | "return.received";

const TIMEOUT_MS = 10_000;

export async function fireWebhookEvent(
  companyId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const subs = await prisma.webhook.findMany({
    where: {
      companyId,
      isActive: true,
      events: { has: event },
    },
    select: { id: true, url: true, secret: true },
  });

  if (subs.length === 0) return;

  const deliveryId = crypto.randomUUID();
  const body = JSON.stringify({
    event,
    deliveryId,
    occurredAt: new Date().toISOString(),
    data: payload,
  });

  await Promise.all(
    subs.map(async (sub) => {
      const start = Date.now();
      let statusCode: number | null = null;
      let responseBody = "";
      let errorMsg: string | null = null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const signature = sign(sub.secret, body);
        const res = await fetch(sub.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "StokTakip-Webhook/1.0",
            "x-stoktakip-signature": signature,
            "x-stoktakip-event": event,
            "x-stoktakip-delivery": deliveryId,
          },
          body,
          signal: controller.signal,
        });
        statusCode = res.status;
        responseBody = (await res.text()).slice(0, 1000);
      } catch (e) {
        errorMsg = e instanceof Error ? e.message : "unknown";
      } finally {
        clearTimeout(timer);
      }

      const duration = Date.now() - start;
      const success =
        statusCode !== null && statusCode >= 200 && statusCode < 300;

      try {
        await prisma.webhookDelivery.create({
          data: {
            webhookId: sub.id,
            companyId,
            event,
            payload: { event, deliveryId, data: payload } as never,
            statusCode,
            responseBody,
            durationMs: duration,
            success,
            error: errorMsg,
          },
        });
      } catch (e) {
        log.error(e, {
          context: "webhook_delivery_log_failed",
          webhookId: sub.id,
        });
      }
    })
  );
}
