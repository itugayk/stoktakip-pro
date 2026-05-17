"use server";

import { withAuth, ok, parseInput, z, ERR } from "@/lib/server";

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

export const listNotifications = withAuth<z.input<typeof listSchema> | undefined, Notification[]>(
  async (ctx, raw) => {
    const filter = parseInput(listSchema, raw ?? {});
    if (ctx.demo) return ok([]);

    let q = ctx.supabase
      .from("notifications")
      .select("id, type, title, message, is_read, created_at, metadata")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(filter.limit ?? 50);

    if (filter.unreadOnly) q = q.eq("is_read", false);
    if (filter.type) q = q.eq("type", filter.type);

    const { data, error } = await q;
    if (error) throw ERR.database(error.message);

    return ok(
      (data ?? []).map((n) => ({
        id: n.id,
        type: n.type as NotificationType,
        title: n.title,
        message: n.message,
        isRead: n.is_read,
        createdAt: n.created_at,
        metadata: (n.metadata as Record<string, unknown>) ?? undefined,
      }))
    );
  }
);

export const getUnreadCount = withAuth<void, number>(async (ctx) => {
  if (ctx.demo) return ok(0);
  const { count, error } = await ctx.supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("is_read", false);
  if (error) throw ERR.database(error.message);
  return ok(count ?? 0);
});

export const markNotificationRead = withAuth<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", ctx.userId);
  if (error) throw ERR.database(error.message);
  return ok();
});

export const markAllNotificationsRead = withAuth<void, { updated: number }>(async (ctx) => {
  if (ctx.demo) return ok({ updated: 0 });
  const { data, error } = await ctx.supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", ctx.userId)
    .eq("is_read", false)
    .select("id");
  if (error) throw ERR.database(error.message);
  return ok({ updated: data?.length ?? 0 });
});

// ============================================
// User preferences for notification channels.
// Stored under profiles.preferences (JSON). Schema below is open-ended so the
// shape can evolve without a migration.
// ============================================

export interface NotificationPrefs {
  channels: Partial<Record<NotificationType, ("in_app" | "email" | "push")[]>>;
}

const prefsSchema = z.object({
  channels: z.record(z.string(), z.array(z.enum(["in_app", "email", "push"]))),
});

export const getNotificationPrefs = withAuth<void, NotificationPrefs>(async (ctx) => {
  if (ctx.demo) return ok({ channels: {} });
  // `profiles.preferences` doesn't exist by default; we store it inline. If
  // the column isn't there yet, treat as empty.
  const { data } = await ctx.supabase
    .from("profiles")
    .select("preferences")
    .eq("id", ctx.userId)
    .maybeSingle();
  const prefs = (data as { preferences?: { notifications?: NotificationPrefs } } | null)?.preferences?.notifications;
  return ok(prefs ?? { channels: {} });
});

export const updateNotificationPrefs = withAuth<z.input<typeof prefsSchema>, void>(
  async (ctx, raw) => {
    const prefs = parseInput(prefsSchema, raw);
    if (ctx.demo) return ok();
    // Read-modify-write so other preferences keys aren't clobbered.
    const { data: existing } = await ctx.supabase
      .from("profiles")
      .select("preferences")
      .eq("id", ctx.userId)
      .single();
    const merged = {
      ...(existing as { preferences?: Record<string, unknown> } | null)?.preferences,
      notifications: prefs,
    };
    const { error } = await ctx.supabase
      .from("profiles")
      .update({ preferences: merged } as never)
      .eq("id", ctx.userId);
    if (error) throw ERR.database(error.message);
    return ok();
  }
);
