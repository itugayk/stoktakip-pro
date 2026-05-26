"use server";

import { withAuth, ok, parseInput, z } from "@/lib/server";

export type NotificationType =
  | "low_stock"
  | "expiry_warning"
  | "expiry_expired"
  | "order_update"
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

const listSchema = z.object({
  unreadOnly: z.boolean().optional(),
  type: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

export const listNotifications = withAuth<
  z.input<typeof listSchema> | undefined,
  Notification[]
>(async (ctx, raw) => {
  const filter = parseInput(listSchema, raw ?? {});

  const rows = await ctx.prisma.notification.findMany({
    where: {
      userId: ctx.userId,
      ...(filter.unreadOnly ? { isRead: false } : {}),
      ...(filter.type ? { type: filter.type as NotificationType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: filter.limit ?? 50,
  });

  return ok(
    rows.map((n) => ({
      id: n.id,
      type: n.type as NotificationType,
      title: n.title,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      metadata: (n.metadata as Record<string, unknown>) ?? undefined,
    }))
  );
});

export const getUnreadCount = withAuth<void, number>(async (ctx) => {
  const count = await ctx.prisma.notification.count({
    where: { userId: ctx.userId, isRead: false },
  });
  return ok(count);
});

export const markNotificationRead = withAuth<string, void>(async (ctx, id) => {
  await ctx.prisma.notification.updateMany({
    where: { id, userId: ctx.userId },
    data: { isRead: true },
  });
  return ok();
});

export const markAllNotificationsRead = withAuth<void, { updated: number }>(
  async (ctx) => {
    const res = await ctx.prisma.notification.updateMany({
      where: { userId: ctx.userId, isRead: false },
      data: { isRead: true },
    });
    return ok({ updated: res.count });
  }
);

// ============================================
// User preferences for notification channels.
// ============================================

export interface NotificationPrefs {
  channels: Partial<Record<NotificationType, ("in_app" | "email" | "push")[]>>;
}

const prefsSchema = z.object({
  channels: z.record(
    z.string(),
    z.array(z.enum(["in_app", "email", "push"]))
  ),
});

export const getNotificationPrefs = withAuth<void, NotificationPrefs>(
  async (ctx) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { preferences: true },
    });
    const prefs = (
      user?.preferences as { notifications?: NotificationPrefs } | null
    )?.notifications;
    return ok(prefs ?? { channels: {} });
  }
);

export const updateNotificationPrefs = withAuth<
  z.input<typeof prefsSchema>,
  void
>(async (ctx, raw) => {
  const prefs = parseInput(prefsSchema, raw);

  // Read-modify-write so other preferences keys aren't clobbered.
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { preferences: true },
  });
  const merged = {
    ...((user?.preferences as Record<string, unknown>) ?? {}),
    notifications: prefs,
  };
  await ctx.prisma.user.update({
    where: { id: ctx.userId },
    data: { preferences: merged },
  });
  return ok();
});
