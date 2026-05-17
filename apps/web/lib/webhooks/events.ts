/**
 * Webhook event taxonomy. Kept in a plain (non-"use server") module so both
 * the server actions and the docs page can import it as a regular array.
 */
export const WEBHOOK_EVENTS = [
  "product.created",
  "product.updated",
  "product.deleted",
  "stock.low",
  "stock.movement",
  "order.created",
  "order.approved",
  "order.shipped",
  "order.received",
  "count.closed",
  "return.created",
  "return.received",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
