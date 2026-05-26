"use server";

import { withAuth, withCompany, ok, parseInput, z } from "@/lib/server";

export type FavoriteEntity = "product" | "supplier" | "customer" | "warehouse";

const toggleSchema = z.object({
  entityType: z.enum(["product", "supplier", "customer", "warehouse"]),
  entityId: z.string(),
});

/** Returns the new state (true = favorited, false = removed). */
export const toggleFavorite = withCompany<
  z.input<typeof toggleSchema>,
  { favorited: boolean }
>(async (ctx, raw) => {
  const data = parseInput(toggleSchema, raw);

  const key = {
    userId_entityType_entityId: {
      userId: ctx.userId,
      entityType: data.entityType,
      entityId: data.entityId,
    },
  };

  const existing = await ctx.prisma.userFavorite.findUnique({
    where: key,
    select: { userId: true },
  });

  if (existing) {
    await ctx.prisma.userFavorite.delete({ where: key });
    return ok({ favorited: false });
  }

  await ctx.prisma.userFavorite.create({
    data: {
      userId: ctx.userId,
      companyId: ctx.companyId,
      entityType: data.entityType,
      entityId: data.entityId,
    },
  });
  return ok({ favorited: true });
});

export const getFavorites = withAuth<
  FavoriteEntity | undefined,
  { entityType: FavoriteEntity; entityId: string }[]
>(async (ctx, entityType) => {
  const rows = await ctx.prisma.userFavorite.findMany({
    where: {
      userId: ctx.userId,
      ...(entityType ? { entityType } : {}),
    },
    select: { entityType: true, entityId: true },
  });

  return ok(
    rows.map((r) => ({
      entityType: r.entityType as FavoriteEntity,
      entityId: r.entityId,
    }))
  );
});
