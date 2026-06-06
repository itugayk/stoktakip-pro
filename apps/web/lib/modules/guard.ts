import { ERR, type AuthCtx } from "@/lib/server";
import { readCompanySettings, resolveEnabledModules } from "@/lib/company/settings";
import type { ModuleKey } from "./registry";

/**
 * Throw `forbidden` if the given module is disabled for the company. Use at the
 * top of server actions that belong to an optional sector module, so a disabled
 * module can't be driven via the API even though its nav is hidden.
 */
export async function assertModuleEnabled(
  ctx: AuthCtx,
  moduleKey: ModuleKey
): Promise<void> {
  const settings = await readCompanySettings(ctx.prisma, ctx.companyId);
  const enabled = resolveEnabledModules(settings);
  if (!enabled.includes(moduleKey)) {
    throw ERR.forbidden("Bu modül işletmeniz için kapalı");
  }
}
