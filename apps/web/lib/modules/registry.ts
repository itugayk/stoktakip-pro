/**
 * Sector / business-type module registry.
 *
 * Pure constants + helpers (no I/O) so this can be imported from both client and
 * server. The company's enabled modules live in `company.settings.enabled_modules`
 * (see `lib/company/settings.ts`); this file maps nav routes ↔ modules and defines
 * the per-sector presets used at onboarding.
 */

export type ModuleKey =
  | "products"
  | "scanner"
  | "inventory"
  | "expiry"
  | "counts"
  | "reorder"
  | "operations"
  | "warehouses"
  | "suppliers"
  | "customers"
  | "purchasing"
  | "sales"
  | "returns"
  | "pricing"
  | "reports"
  | "tasks"
  | "integrations"
  | "recipes";

export const ALL_MODULES: ModuleKey[] = [
  "products",
  "scanner",
  "inventory",
  "expiry",
  "counts",
  "reorder",
  "operations",
  "warehouses",
  "suppliers",
  "customers",
  "purchasing",
  "sales",
  "returns",
  "pricing",
  "reports",
  "tasks",
  "integrations",
  "recipes",
];

/** Human labels for each module (used in the settings toggles). */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  products: "Ürünler / Kategoriler",
  scanner: "Barkod Tarayıcı",
  inventory: "Stok Hareketleri",
  expiry: "Son Kullanma Takibi",
  counts: "Sayımlar",
  reorder: "Sipariş Önerileri",
  operations: "Operasyon Paneli",
  warehouses: "Depolar / Lokasyonlar",
  suppliers: "Tedarikçiler",
  customers: "Müşteriler",
  purchasing: "Satın Alma Siparişleri",
  sales: "Satış Siparişleri",
  returns: "İadeler",
  pricing: "Fiyat Listeleri",
  reports: "Raporlar",
  tasks: "Görevler",
  integrations: "Entegrasyonlar",
  recipes: "Reçeteler (Üretim)",
};

/**
 * Exact nav href → module. `"core"` routes are always visible regardless of the
 * enabled module set (dashboard, notifications, team, settings).
 */
const HREF_MODULE: Record<string, ModuleKey | "core"> = {
  "/dashboard": "core",
  "/dashboard/products": "products",
  "/dashboard/categories": "products",
  "/dashboard/scanner": "scanner",
  "/dashboard/inventory": "inventory",
  "/dashboard/inventory/expiry": "expiry",
  "/dashboard/counts": "counts",
  "/dashboard/reorder": "reorder",
  "/dashboard/operations": "operations",
  "/dashboard/warehouses": "warehouses",
  "/dashboard/suppliers": "suppliers",
  "/dashboard/customers": "customers",
  "/dashboard/orders/purchase": "purchasing",
  "/dashboard/orders/sales": "sales",
  "/dashboard/returns": "returns",
  "/dashboard/price-lists": "pricing",
  "/dashboard/reports": "reports",
  "/dashboard/recipes": "recipes",
  "/dashboard/tasks": "tasks",
  "/dashboard/team": "core",
  "/dashboard/integrations": "integrations",
  "/dashboard/notifications": "core",
  "/dashboard/settings": "core",
};

/** Resolve the module a nav href belongs to. Unknown hrefs default to core. */
export function moduleForHref(href: string): ModuleKey | "core" {
  return HREF_MODULE[href] ?? "core";
}

/** Whether a nav href should be visible given the enabled module set. */
export function isHrefEnabled(href: string, enabled: ModuleKey[]): boolean {
  const m = moduleForHref(href);
  if (m === "core") return true;
  return enabled.includes(m);
}

export type BusinessType =
  | "general"
  | "market"
  | "pharmacy"
  | "restaurant"
  | "wholesale";

/** Labels that can be sector-overridden (shown in nav / page titles). */
export type TermKey = "products" | "categories";

export interface BusinessPreset {
  label: string;
  description: string;
  icon: string; // lucide icon name (resolved at the UI layer)
  enabledModules: ModuleKey[];
  terms?: Partial<Record<TermKey, string>>;
}

export const BUSINESS_PRESETS: Record<BusinessType, BusinessPreset> = {
  general: {
    label: "Genel / Diğer",
    description: "Tüm modüller açık. Sektörünüze sonra karar verebilirsiniz.",
    icon: "Building2",
    enabledModules: [...ALL_MODULES],
  },
  market: {
    label: "Market / Perakende",
    description: "Barkod, son kullanma tarihi ve hızlı satış odaklı.",
    icon: "ShoppingCart",
    enabledModules: [
      "products", "scanner", "inventory", "expiry", "counts", "reorder",
      "suppliers", "customers", "purchasing", "sales", "returns", "pricing",
      "reports", "tasks",
    ],
  },
  pharmacy: {
    label: "Eczane / Medikal",
    description: "Lot ve miad takibi zorunlu, son kullanma uyarıları öne çıkar.",
    icon: "Pill",
    enabledModules: [
      "products", "scanner", "inventory", "expiry", "counts", "reorder",
      "suppliers", "customers", "purchasing", "sales", "returns",
      "reports", "tasks",
    ],
    terms: { products: "İlaçlar" },
  },
  restaurant: {
    label: "Restoran / Kafe",
    description: "Malzeme stoğu ve maliyet odaklı (reçete modülü yakında).",
    icon: "UtensilsCrossed",
    enabledModules: [
      "products", "recipes", "inventory", "expiry", "counts", "reorder",
      "suppliers", "purchasing", "reports", "tasks",
    ],
    terms: { products: "Malzemeler", categories: "Malzeme Grupları" },
  },
  wholesale: {
    label: "Toptan / Depo",
    description: "Çoklu depo, lokasyon ve sevkiyat ağırlıklı.",
    icon: "Warehouse",
    enabledModules: [...ALL_MODULES],
  },
};

export const BUSINESS_TYPES: BusinessType[] = [
  "market",
  "pharmacy",
  "restaurant",
  "wholesale",
  "general",
];

/** The module set for a business type (falls back to all modules). */
export function modulesForBusiness(type: BusinessType): ModuleKey[] {
  return BUSINESS_PRESETS[type]?.enabledModules ?? [...ALL_MODULES];
}

/** Resolve a possibly sector-overridden label for a term, with a fallback. */
export function term(
  type: BusinessType,
  key: TermKey,
  fallback: string
): string {
  return BUSINESS_PRESETS[type]?.terms?.[key] ?? fallback;
}
