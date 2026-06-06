import { describe, it, expect } from "vitest";
import { PLANS, planLimit, hasFeature, planDef } from "@/lib/billing/plans";

describe("plan limits", () => {
  it("free is the most restrictive, enterprise unlimited", () => {
    expect(planLimit("free", "products")).toBe(100);
    expect(planLimit("free", "warehouses")).toBe(1);
    expect(planLimit("enterprise", "products")).toBeNull();
    expect(planLimit("enterprise", "users")).toBeNull();
  });

  it("professional has unlimited products/warehouses but capped users", () => {
    expect(planLimit("professional", "products")).toBeNull();
    expect(planLimit("professional", "warehouses")).toBeNull();
    expect(planLimit("professional", "users")).toBe(20);
  });

  it("unknown/empty plan falls back to free", () => {
    expect(planDef(null).id).toBe("free");
    expect(planLimit(undefined, "products")).toBe(100);
  });
});

describe("feature gating", () => {
  it("integrations only from professional up", () => {
    expect(hasFeature("free", "integrations")).toBe(false);
    expect(hasFeature("starter", "integrations")).toBe(false);
    expect(hasFeature("professional", "integrations")).toBe(true);
  });

  it("enterprise wildcard unlocks everything", () => {
    expect(hasFeature("enterprise", "anything-at-all")).toBe(true);
  });

  it("every plan includes the core feature", () => {
    for (const p of Object.values(PLANS)) {
      expect(hasFeature(p.id, "core")).toBe(true);
    }
  });
});
