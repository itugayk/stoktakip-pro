import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-SHA256 signature for webhook payloads.
 *
 * We send three headers:
 *   X-StokTakip-Signature: t=<unix_ms>,v1=<hex>
 *   X-StokTakip-Event:     <event_name>
 *   X-StokTakip-Delivery:  <delivery_uuid>
 *
 * Subscribers compute `HMAC-SHA256(secret, "<unix_ms>.<raw_body>")` and
 * compare against v1 with constant-time equality. The timestamp prefix
 * mitigates replay attacks if the subscriber also rejects > 5 min skew.
 */

export function sign(secret: string, body: string, timestamp: number = Date.now()): string {
  const signed = `${timestamp}.${body}`;
  const v1 = createHmac("sha256", secret).update(signed).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

export function verify(secret: string, body: string, header: string | null, toleranceMs = 5 * 60 * 1000): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k.trim(), v?.trim() ?? ""];
    })
  );
  const ts = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(ts) || !v1) return false;
  if (Math.abs(Date.now() - ts) > toleranceMs) return false;

  const expected = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const a = Buffer.from(v1, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function randomSecret(): string {
  // 48 chars of url-safe base36. Enough entropy for HMAC; easy to copy.
  return "whsec_" + (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  ).slice(0, 42);
}
