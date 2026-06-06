import { AppError, type AuthCtx } from "@/lib/server";
import { planLimit, type LimitResource } from "./plans";

const LIMIT_KEY: Record<LimitResource, "maxUsers" | "maxProducts" | "maxWarehouses"> = {
  users: "maxUsers",
  products: "maxProducts",
  warehouses: "maxWarehouses",
};

async function currentCount(ctx: AuthCtx, resource: LimitResource): Promise<number> {
  switch (resource) {
    case "users": {
      // Seats consumed = active users + still-pending invitations.
      const [users, pending] = await Promise.all([
        ctx.prisma.user.count({ where: { companyId: ctx.companyId } }),
        ctx.prisma.invitation.count({
          where: { companyId: ctx.companyId, acceptedAt: null },
        }),
      ]);
      return users + pending;
    }
    case "products":
      return ctx.prisma.product.count({
        where: { companyId: ctx.companyId, isActive: true },
      });
    case "warehouses":
      return ctx.prisma.warehouse.count({
        where: { companyId: ctx.companyId, isActive: true },
      });
  }
}

/** Resolve the effective limit for a resource (subscriptionLimits override wins). */
async function effectiveLimit(
  ctx: AuthCtx,
  resource: LimitResource
): Promise<number | null> {
  const company = await ctx.prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: { subscriptionPlan: true, subscriptionLimits: true },
  });
  const override =
    (company?.subscriptionLimits as Record<string, number | null> | null) ?? {};
  const key = LIMIT_KEY[resource];
  if (override[key] != null) return override[key];
  return planLimit(company?.subscriptionPlan ?? "free", resource);
}

/**
 * Throw `plan_limit` if creating `incoming` more of `resource` would exceed the
 * company's plan limit. Call before creating products / warehouses / inviting users.
 */
export async function assertWithinLimit(
  ctx: AuthCtx,
  resource: LimitResource,
  incoming = 1
): Promise<void> {
  const limit = await effectiveLimit(ctx, resource);
  if (limit === null) return; // unlimited
  const count = await currentCount(ctx, resource);
  if (count + incoming > limit) {
    throw new AppError(
      "plan_limit",
      `Plan sınırına ulaştınız (${limit}). Daha fazlası için planınızı yükseltin.`
    );
  }
}
