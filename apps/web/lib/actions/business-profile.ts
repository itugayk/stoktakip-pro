"use server";

import { withAuth, withRole, ok, parseInput, z } from "@/lib/server";
import {
  readCompanySettings,
  resolveBusinessType,
  resolveEnabledModules,
} from "@/lib/company/settings";
import {
  ALL_MODULES,
  type BusinessType,
  type ModuleKey,
} from "@/lib/modules/registry";

export interface BusinessProfile {
  businessType: BusinessType;
  enabledModules: ModuleKey[];
  /** True when modules were manually overridden (vs. derived from the preset). */
  hasOverride: boolean;
}

export const getBusinessProfile = withAuth<void, BusinessProfile>(
  async (ctx) => {
    const s = await readCompanySettings(ctx.prisma, ctx.companyId);
    return ok({
      businessType: resolveBusinessType(s),
      enabledModules: resolveEnabledModules(s),
      hasOverride: Array.isArray(s.enabled_modules) && s.enabled_modules.length > 0,
    });
  }
);

const updateSchema = z.object({
  businessType: z
    .enum(["general", "market", "pharmacy", "restaurant", "wholesale"])
    .optional(),
  enabledModules: z.array(z.enum(ALL_MODULES as [ModuleKey, ...ModuleKey[]])).optional(),
});

/**
 * Update the company's sector profile. Admin only.
 * - Passing `businessType` alone applies that sector's preset and clears any
 *   manual per-module override.
 * - Passing `enabledModules` stores a manual override (wins over the preset).
 */
export const updateBusinessProfile = withRole<
  z.input<typeof updateSchema>,
  void
>(["admin"], async (ctx, raw) => {
  const data = parseInput(updateSchema, raw);
  const current = await readCompanySettings(ctx.prisma, ctx.companyId);
  const next = { ...current };

  if (data.businessType !== undefined) {
    next.business_type = data.businessType;
    if (data.enabledModules === undefined) {
      // Applying a preset resets any manual override.
      delete next.enabled_modules;
    }
  }
  if (data.enabledModules !== undefined) {
    next.enabled_modules = data.enabledModules;
  }

  await ctx.prisma.company.update({
    where: { id: ctx.companyId },
    data: { settings: next as never },
  });

  return ok();
});
