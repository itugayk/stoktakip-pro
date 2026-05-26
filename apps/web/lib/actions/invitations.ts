"use server";

import { withRole, withAuth, ok, fail, parseInput, z } from "@/lib/server";
import type { UserRole } from "@/lib/types";

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  warehouseIds: string[];
  token: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

const createSchema = z.object({
  email: z.string().email("Geçerli e-posta girin"),
  role: z.enum(["admin", "manager", "warehouse_staff", "viewer"]),
  warehouseIds: z.array(z.string()).optional(),
});

function randomToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "")
    );
  }
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}

export const listInvitations = withAuth<void, Invitation[]>(async (ctx) => {
  const rows = await ctx.prisma.invitation.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      warehouseIds: r.warehouseIds ?? [],
      token: r.token,
      expiresAt: r.expiresAt.toISOString(),
      acceptedAt: r.acceptedAt?.toISOString() ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

/** Only admin can invite. */
export const createInvitation = withRole<
  z.input<typeof createSchema>,
  { token: string }
>(["admin"], async (ctx, raw) => {
  const data = parseInput(createSchema, raw);

  // Check user limit before issuing the invite.
  const company = await ctx.prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: { maxUsers: true, subscriptionLimits: true },
  });
  const limits =
    (company?.subscriptionLimits as { maxUsers?: number } | null) ?? {};
  const hardLimit = limits.maxUsers ?? company?.maxUsers ?? null;
  if (hardLimit !== null) {
    const [userCount, pendingCount] = await Promise.all([
      ctx.prisma.user.count({ where: { companyId: ctx.companyId } }),
      ctx.prisma.invitation.count({
        where: { companyId: ctx.companyId, acceptedAt: null },
      }),
    ]);
    if (userCount + pendingCount >= hardLimit) {
      return fail(
        "plan_limit",
        `Plan kullanıcı sınırına ulaştınız (${hardLimit}).`
      );
    }
  }

  const token = randomToken();
  await ctx.prisma.invitation.upsert({
    where: {
      companyId_email: {
        companyId: ctx.companyId,
        email: data.email.toLowerCase(),
      },
    },
    update: {
      role: data.role,
      warehouseIds: data.warehouseIds ?? [],
      token,
      invitedById: ctx.userId,
      expiresAt: new Date(Date.now() + 7 * 86400000),
      acceptedAt: null,
      acceptedById: null,
    },
    create: {
      companyId: ctx.companyId,
      email: data.email.toLowerCase(),
      role: data.role,
      warehouseIds: data.warehouseIds ?? [],
      token,
      invitedById: ctx.userId,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });

  return ok({ token });
});

export const revokeInvitation = withRole<string, void>(["admin"], async (ctx, id) => {
  await ctx.prisma.invitation.deleteMany({
    where: { id, companyId: ctx.companyId, acceptedAt: null },
  });
  return ok();
});

const acceptSchema = z.object({ token: z.string() });

export const acceptInvitation = withAuth<
  z.input<typeof acceptSchema>,
  { companyId: string }
>(async (ctx, raw) => {
  const { token } = parseInput(acceptSchema, raw);

  const inv = await ctx.prisma.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      companyId: true,
      email: true,
      role: true,
      warehouseIds: true,
      expiresAt: true,
      acceptedAt: true,
    },
  });
  if (!inv) return fail("not_found", "Geçersiz davet kodu");
  if (inv.acceptedAt) return fail("already_accepted", "Bu davet zaten kullanılmış");
  if (inv.expiresAt < new Date()) return fail("expired", "Davet süresi dolmuş");

  await ctx.prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: ctx.userId },
      data: {
        companyId: inv.companyId,
        role: inv.role,
        warehouseIds: inv.warehouseIds ?? [],
      },
    });

    await tx.invitation.update({
      where: { id: inv.id },
      data: { acceptedAt: new Date(), acceptedById: ctx.userId },
    });
  });

  return ok({ companyId: inv.companyId });
});
