import type { Prisma, PrismaClient } from "@prisma/client";
import {
  ALL_MODULES,
  modulesForBusiness,
  type BusinessType,
  type ModuleKey,
} from "@/lib/modules/registry";

/**
 * Typed view of the `company.settings` JSONB blob. Previously every reader cast
 * it ad-hoc (`{ po_approval_threshold?: number }` etc.); this is the single shape.
 */
export interface CompanySettings {
  onboarding_completed_at?: string;
  po_approval_threshold?: number;
  allow_negative_stock?: boolean;
  scheduledDeletionAt?: string;
  business_type?: BusinessType;
  /** Explicit module override; when set it wins over the business-type preset. */
  enabled_modules?: ModuleKey[];
}

type DB = PrismaClient | Prisma.TransactionClient;

export async function readCompanySettings(
  db: DB,
  companyId: string
): Promise<CompanySettings> {
  const c = await db.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  return (c?.settings as CompanySettings | null) ?? {};
}

/** Shallow-merge a patch into the existing settings and persist. Returns the merged result. */
export async function writeCompanySettings(
  db: DB,
  companyId: string,
  patch: Partial<CompanySettings>
): Promise<CompanySettings> {
  const current = await readCompanySettings(db, companyId);
  const next: CompanySettings = { ...current, ...patch };
  await db.company.update({
    where: { id: companyId },
    data: { settings: next as never },
  });
  return next;
}

/**
 * Effective enabled-module list for a company: explicit override → business-type
 * preset → all modules (backwards-compatible default for companies that never
 * picked a sector).
 */
export function resolveEnabledModules(settings: CompanySettings): ModuleKey[] {
  if (settings.enabled_modules && settings.enabled_modules.length > 0) {
    return settings.enabled_modules;
  }
  if (settings.business_type) return modulesForBusiness(settings.business_type);
  return [...ALL_MODULES];
}

export function resolveBusinessType(settings: CompanySettings): BusinessType {
  return settings.business_type ?? "general";
}
