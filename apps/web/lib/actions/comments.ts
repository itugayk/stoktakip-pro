"use server";

import { withAuth, withCompany, ok, parseInput, z } from "@/lib/server";

export type CommentEntityType =
  | "product"
  | "purchase_order"
  | "sales_order"
  | "count"
  | "return"
  | "task";

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
  entityType: z.enum([
    "product",
    "purchase_order",
    "sales_order",
    "count",
    "return",
    "task",
  ]),
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

    const rows = await ctx.prisma.comment.findMany({
      where: {
        companyId: ctx.companyId,
        entityType,
        entityId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { fullName: true } },
      },
    });

    return ok(
      rows.map((r) => ({
        id: r.id,
        body: r.body,
        userId: r.userId,
        userName: r.user?.fullName,
        mentions: r.mentions ?? [],
        createdAt: r.createdAt.toISOString(),
        editedAt: r.editedAt?.toISOString() ?? undefined,
      }))
    );
  }
);

export const createComment = withCompany<
  z.input<typeof createSchema>,
  { id: string; mentions: string[] }
>(async (ctx, raw) => {
  const data = parseInput(createSchema, raw);

  // Resolve @mentions in the body to user IDs. Match by lowercased fullname
  // (whitespace removed). Anything that doesn't resolve stays textual.
  const tokens = Array.from(data.body.matchAll(MENTION_RE), (m) =>
    m[1].toLowerCase()
  );
  let mentionIds: string[] = data.mentions ?? [];
  if (tokens.length > 0 && mentionIds.length === 0) {
    const users = await ctx.prisma.user.findMany({
      where: { companyId: ctx.companyId, isActive: true },
      select: { id: true, fullName: true },
    });
    mentionIds = users
      .filter((u) => {
        const norm = u.fullName.toLowerCase().replace(/\s+/g, "");
        return tokens.some((t) => norm.includes(t));
      })
      .map((u) => u.id);
  }

  const row = await ctx.prisma.comment.create({
    data: {
      companyId: ctx.companyId,
      entityType: data.entityType,
      entityId: data.entityId,
      userId: ctx.userId,
      body: data.body,
      mentions: mentionIds.length > 0 ? mentionIds : [],
    },
    select: { id: true },
  });

  // Side effect: notify mentioned users.
  if (mentionIds.length > 0) {
    await ctx.prisma.notification.createMany({
      data: mentionIds.map((uid) => ({
        companyId: ctx.companyId,
        userId: uid,
        type: "system",
        title: "Bir yorumda bahsedildiniz",
        message: data.body.slice(0, 200),
        metadata: {
          entityType: data.entityType,
          entityId: data.entityId,
          commentId: row.id,
        },
      })),
    });
  }

  return ok({ id: row.id, mentions: mentionIds });
});

const deleteSchema = z.object({ commentId: z.string() });

export const deleteComment = withAuth<z.input<typeof deleteSchema>, void>(
  async (ctx, raw) => {
    const { commentId } = parseInput(deleteSchema, raw);
    // Author-only delete; ownership enforced by composite where.
    await ctx.prisma.comment.deleteMany({
      where: {
        id: commentId,
        userId: ctx.userId,
        companyId: ctx.companyId,
      },
    });
    return ok();
  }
);
