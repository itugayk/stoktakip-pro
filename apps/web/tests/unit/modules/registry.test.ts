import { describe, it, expect } from "vitest";
import {
  moduleForHref,
  isHrefEnabled,
  modulesForBusiness,
  term,
  ALL_MODULES,
  BUSINESS_PRESETS,
} from "@/lib/modules/registry";

describe("moduleForHref", () => {
  it("maps known routes to their module", () => {
    expect(moduleForHref("/dashboard/orders/sales")).toBe("sales");
    expect(moduleForHref("/dashboard/inventory/expiry")).toBe("expiry");
    expect(moduleForHref("/dashboard/products")).toBe("products");
  });

  it("treats dashboard/settings/team/notifications as core", () => {
    expect(moduleForHref("/dashboard")).toBe("core");
    expect(moduleForHref("/dashboard/settings")).toBe("core");
    expect(moduleForHref("/dashboard/team")).toBe("core");
    expect(moduleForHref("/dashboard/notifications")).toBe("core");
  });

  it("defaults unknown routes to core (never hidden by accident)", () => {
    expect(moduleForHref("/dashboard/something-new")).toBe("core");
  });
});

describe("isHrefEnabled", () => {
  it("always shows core routes regardless of enabled set", () => {
    expect(isHrefEnabled("/dashboard", [])).toBe(true);
    expect(isHrefEnabled("/dashboard/settings", [])).toBe(true);
  });

  it("shows a module route only when its module is enabled", () => {
    expect(isHrefEnabled("/dashboard/orders/sales", ["sales"])).toBe(true);
    expect(isHrefEnabled("/dashboard/orders/sales", ["purchasing"])).toBe(false);
  });
});

describe("business presets", () => {
  it("restaurant hides sales and pricing", () => {
    const mods = modulesForBusiness("restaurant");
    expect(mods).not.toContain("sales");
    expect(mods).not.toContain("pricing");
    expect(mods).toContain("inventory");
  });

  it("general and wholesale enable every module", () => {
    expect(modulesForBusiness("general").sort()).toEqual([...ALL_MODULES].sort());
    expect(modulesForBusiness("wholesale").sort()).toEqual([...ALL_MODULES].sort());
  });

  it("every preset only references valid module keys", () => {
    for (const preset of Object.values(BUSINESS_PRESETS)) {
      for (const m of preset.enabledModules) {
        expect(ALL_MODULES).toContain(m);
      }
    }
  });
});

describe("term", () => {
  it("overrides 'products' for pharmacy and restaurant, falls back otherwise", () => {
    expect(term("pharmacy", "products", "Ürünler")).toBe("İlaçlar");
    expect(term("restaurant", "products", "Ürünler")).toBe("Malzemeler");
    expect(term("market", "products", "Ürünler")).toBe("Ürünler");
  });
});
