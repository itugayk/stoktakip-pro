"use server";

import { withAuth, withCompany, ok, parseInput, z, ERR } from "@/lib/server";

export type CommentEntityType = "product" | "purchase_order" | "sales_order" | "count" | "return" | "task";

export interface Comment {
  id: string;
  body: string;
  userId: string;
  userName?: string;
  mentions: string[];
  createdAt: string;
  editedAt?: string;
}

const querySchema = z.object({
  entityType: z.enum(["product", "purchase_order", "sales_order", "count", "return", "task"]),
  entityId: z.string(),
});

const createSchema = querySchema.extend({
  body: z.string().min(1, "Yorum boş olamaz").max(5000, "Çok uzun"),
  mentions: z.array(z.string()).optional(),
});

const MENTION_RE = /@([\w.\-_]+)/g;

export const listComments = withAuth<z.input<typeof querySchema>, Comment[]>(
  async (ctx, raw) => {
    const { entityType, entityId } = parseInput(querySchema, raw);
    if (ctx.demo) return ok([]);

    const { data, error } = await ctx.supabase
      .from("comments")
      .select(`
        id, body, user_id, mentions, edited_at, created_at,
        user:profiles!comments_user_id_fkey(full_name)
      `)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });
    if (error) throw ERR.database(error.message);

    return ok(
      (data ?? []).map((r) => {
        const userRaw = r.user as { full_name: string } | { full_name: string }[] | null;
        const user = Array.isArray(userRaw) ? userRaw[0] : userRaw;
        return {
          id: r.id,
          body: r.body,
          userId: r.user_id,
          userName: user?.full_name,
          mentions: r.mentions ?? [],
          createdAt: r.created_at,
          editedAt: r.edited_at ?? undefined,
        };
      })
    );
  }
);

export const createComment = withCompany<z.input<typeof createSchema>, { id: string; mentions: string[] }>(
  async (ctx, raw) => {
    const data = parseInput(createSchema, raw);
    if (ctx.demo) return ok({ id: `c-${Date.now()}`, mentions: [] });

    // Resolve @mentions in the body to profile ids. Match by exact full_name
    // (lowercased; spaces removed). Anything that doesn't resolve stays
    // textual.
    const tokens = Array.from(data.body.matchAll(MENTION_RE), (m) => m[1].toLowerCase());
    let mentionIds: string[] = data.mentions ?? [];
    if (tokens.length > 0 && mentionIds.length === 0) {
      const { data: profiles } = await ctx.supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", ctx.companyId);
      mentionIds = (profiles ?? [])
        .filter((p) => {
          const norm = p.full_name.toLowerCase().replace(/\s+/g, "");
          return tokens.some((t) => norm.includes(t));
        })
        .map((p) => p.id);
    }

    const { data: row, error } = await ctx.supabase
      .from("comments")
      .insert({
        company_id: ctx.companyId,
        entity_type: data.entityType,
        entity_id: data.entityId,
        user_id: ctx.userId,
        body: data.body,
        mentions: mentionIds.length > 0 ? mentionIds : null,
      } as never)
      .select("id")
      .single();
    if (error) throw ERR.database(error.message);

    // Side effect: notify mentioned users.
    if (mentionIds.length > 0) {
      const inserts = mentionIds.map((uid) => ({
        company_id: ctx.companyId,
        user_id: uid,
        type: "system",
        title: `Bir yorumda bahsedildiniz`,
        message: data.body.slice(0, 200),
        metadata: { entityType: data.entityType, entityId: data.entityId, commentId: row.id },
      }));
      await ctx.supabase.from("notifications").insert(inserts as never);
    }

    return ok({ id: row.id, mentions: mentionIds });
  }
);

const deleteSchema = z.object({ commentId: z.string() });

export const deleteComment = withAuth<z.input<typeof deleteSchema>, void>(async (ctx, raw) => {
  const { commentId } = parseInput(deleteSchema, raw);
  if (ctx.demo) return ok();
  // RLS allows the author (or any company member) to delete.
  const { error } = await ctx.supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", ctx.userId);
  if (error) throw ERR.database(error.message);
  return ok();
});
