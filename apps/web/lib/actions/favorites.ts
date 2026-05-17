"use server";

import { withAuth, withCompany, ok, parseInput, z, ERR } from "@/lib/server";

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
  if (ctx.demo) return ok({ favorited: true });

  // Check current state first to decide insert vs delete.
  const { data: existing } = await ctx.supabase
    .from("user_favorites")
    .select("user_id")
    .eq("user_id", ctx.userId)
    .eq("entity_type", data.entityType)
    .eq("entity_id", data.entityId)
    .maybeSingle();

  if (existing) {
    const { error } = await ctx.supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", ctx.userId)
      .eq("entity_type", data.entityType)
      .eq("entity_id", data.entityId);
    if (error) throw ERR.database(error.message);
    return ok({ favorited: false });
  }

  const { error } = await ctx.supabase.from("user_favorites").insert({
    user_id: ctx.userId,
    company_id: ctx.companyId,
    entity_type: data.entityType,
    entity_id: data.entityId,
  } as never);
  if (error) throw ERR.database(error.message);
  return ok({ favorited: true });
});

export const getFavorites = withAuth<FavoriteEntity | undefined, { entityType: FavoriteEntity; entityId: string }[]>(
  async (ctx, entityType) => {
    if (ctx.demo) return ok([]);
    let q = ctx.supabase
      .from("user_favorites")
      .select("entity_type, entity_id")
      .eq("user_id", ctx.userId);
    if (entityType) q = q.eq("entity_type", entityType);

    const { data, error } = await q;
    if (error) throw ERR.database(error.message);
    return ok(
      (data ?? []).map((r) => ({
        entityType: r.entity_type as FavoriteEntity,
        entityId: r.entity_id,
      }))
    );
  }
);
