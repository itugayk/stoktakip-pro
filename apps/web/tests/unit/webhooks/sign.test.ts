import { describe, it, expect } from "vitest";
import { sign, verify, randomSecret } from "@/lib/webhooks/sign";

describe("webhook signing", () => {
  it("sign + verify round-trips", () => {
    const secret = "whsec_abc123";
    const body = JSON.stringify({ event: "stock.low", data: { productId: "p1" } });
    const header = sign(secret, body);
    expect(verify(secret, body, header)).toBe(true);
  });

  it("rejects a different secret", () => {
    const body = "{}";
    const header = sign("correct", body);
    expect(verify("wrong", body, header)).toBe(false);
  });

  it("rejects tampered body", () => {
    const secret = "whsec_abc";
    const header = sign(secret, "{}");
    expect(verify(secret, "{tampered:1}", header)).toBe(false);
  });

  it("rejects stale timestamps", () => {
    const secret = "whsec_abc";
    const body = "{}";
    // 10 minutes in the past
    const header = sign(secret, body, Date.now() - 10 * 60 * 1000);
    expect(verify(secret, body, header)).toBe(false);
  });

  it("rejects null / missing header", () => {
    expect(verify("any", "{}", null)).toBe(false);
    expect(verify("any", "{}", "")).toBe(false);
  });

  it("randomSecret has the expected prefix and length", () => {
    const s = randomSecret();
    expect(s.startsWith("whsec_")).toBe(true);
    expect(s.length).toBeGreaterThan(20);
  });
});
