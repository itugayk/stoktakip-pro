/**
 * Single source of truth for subscription plans: limits + feature flags.
 * Pure constants (importable client + server) — the pricing page, plan-limit
 * enforcement, and feature gating all read from here so they can't drift.
 *
 * `null` limit = unlimited.
 */

export type PlanId = "free" | "starter" | "professional" | "enterprise";
export type LimitResource = "users" | "products" | "warehouses";

export interface PlanDef {
  id: PlanId;
  label: string;
  /** Monthly price in TRY (0 = free, null = custom/contact). */
  priceMonthly: number | null;
  limits: Record<LimitResource, number | null>;
  /** Feature keys this plan unlocks. `"*"` means everything. */
  features: string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    label: "Ücretsiz",
    priceMonthly: 0,
    limits: { users: 1, products: 100, warehouses: 1 },
    features: ["core"],
  },
  starter: {
    id: "starter",
    label: "Başlangıç",
    priceMonthly: 199,
    limits: { users: 5, products: 1000, warehouses: 3 },
    features: ["core", "reports", "returns", "price_lists"],
  },
  professional: {
    id: "professional",
    label: "Profesyonel",
    priceMonthly: 499,
    limits: { users: 20, products: null, warehouses: null },
    features: [
      "core", "reports", "returns", "price_lists",
      "integrations", "webhooks", "api", "scheduled_reports",
    ],
  },
  enterprise: {
    id: "enterprise",
    label: "Kurumsal",
    priceMonthly: null,
    limits: { users: null, products: null, warehouses: null },
    features: ["*"],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "starter", "professional", "enterprise"];

export function planDef(plan: string | null | undefined): PlanDef {
  return PLANS[(plan as PlanId) ?? "free"] ?? PLANS.free;
}

/** Limit for a resource on a plan (null = unlimited). */
export function planLimit(plan: string | null | undefined, resource: LimitResource): number | null {
  return planDef(plan).limits[resource];
}

/** Whether a plan unlocks a feature. */
export function hasFeature(plan: string | null | undefined, feature: string): boolean {
  const def = planDef(plan);
  return def.features.includes("*") || def.features.includes(feature);
}
