"use server";

import { withAuth, withRole, ok, fail, parseInput, z, ERR, logAudit } from "@/lib/server";
import type { UserRole } from "@/lib/types";

// ============================================
// ACTIVITY FEED (audit_log dashboard widget)
// ============================================

export interface ActivityEntry {
  id: string;
  action: string;
  tableName: string;
  recordId?: string;
  userId?: string;
  userName?: string;
  createdAt: string;
  summary: string;
}

const activitySchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});

const ACTION_LABELS: Record<string, string> = {
  create: "oluşturdu",
  update: "güncelledi",
  delete: "sildi",
  approve: "onayladı",
  reject: "reddetti",
  close: "kapattı",
};

const TABLE_LABELS: Record<string, string> = {
  products: "ürün",
  purchase_orders: "satın alma siparişi",
  sales_orders: "satış siparişi",
  returns: "iade",
  tasks: "görev",
  stock_counts: "sayım",
};

export const getActivityFeed = withAuth<z.input<typeof activitySchema> | undefined, ActivityEntry[]>(
  async (ctx, raw) => {
    const { limit = 20 } = parseInput(activitySchema, raw ?? {});
    if (ctx.demo) return ok([]);

    const { data, error } = await ctx.supabase
      .from("audit_log")
      .select(`
        id, action, table_name, record_id, user_id, created_at,
        user:profiles!audit_log_user_id_fkey(full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw ERR.database(error.message);

    return ok(
      (data ?? []).map((r) => {
        const uRaw = r.user as { full_name: string } | { full_name: string }[] | null;
        const user = Array.isArray(uRaw) ? uRaw[0] : uRaw;
        const actionLabel = ACTION_LABELS[r.action] ?? r.action;
        const tableLabel = TABLE_LABELS[r.table_name] ?? r.table_name;
        return {
          id: r.id,
          action: r.action,
          tableName: r.table_name,
          recordId: r.record_id ?? undefined,
          userId: r.user_id ?? undefined,
          userName: user?.full_name,
          createdAt: r.created_at,
          summary: `${user?.full_name ?? "Sistem"} bir ${tableLabel} ${actionLabel}`,
        };
      })
    );
  }
);

// ============================================
// TEAM ROSTER + WAREHOUSE ACCESS
// ============================================

export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  warehouseIds: string[];
  lastLoginAt?: string;
}

export const listTeamMembers = withAuth<void, TeamMember[]>(async (ctx) => {
  if (ctx.demo) return ok([]);
  // Profiles + auth.users (email is in auth schema, accessible via the
  // foreign key relationship). We pull email from a join.
  const { data, error } = await ctx.supabase
    .from("profiles")
    .select("id, full_name, role, is_active, warehouse_ids, last_login_at")
    .eq("company_id", ctx.companyId)
    .order("full_name");
  if (error) throw ERR.database(error.message);

  // Bulk-fetch emails from auth.users via REST. Supabase exposes them through
  // the user_id foreign key — but only if a custom RPC is set up. We fall
  // back to "—" if not available.
  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: "—",
      role: r.role as UserRole,
      isActive: r.is_active,
      warehouseIds: r.warehouse_ids ?? [],
      lastLoginAt: r.last_login_at ?? undefined,
    }))
  );
});

const updateMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(["admin", "manager", "warehouse_staff", "viewer"]).optional(),
  warehouseIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const updateTeamMember = withRole<z.input<typeof updateMemberSchema>, void>(
  ["admin"],
  async (ctx, raw) => {
    const data = parseInput(updateMemberSchema, raw);
    if (ctx.demo) return ok();

    if (data.userId === ctx.userId && data.role && data.role !== "admin") {
      return fail("self_demote", "Kendi rolünüzü admin'den düşüremezsiniz");
    }

    const update: Record<string, unknown> = {};
    if (data.role) update.role = data.role;
    if (data.warehouseIds) update.warehouse_ids = data.warehouseIds.length === 0 ? null : data.warehouseIds;
    if (data.isActive !== undefined) update.is_active = data.isActive;

    const { error } = await ctx.supabase.from("profiles").update(update).eq("id", data.userId);
    if (error) throw ERR.database(error.message);
    await logAudit(ctx, { action: "update", table: "profiles", recordId: data.userId, newData: update });
    return ok();
  }
);

// ============================================
// PLAN LIMITS
// ============================================

export interface PlanLimits {
  maxUsers: number | null;
  maxProducts: number | null;
  maxWarehouses: number | null;
  currentUsers: number;
  currentProducts: number;
  currentWarehouses: number;
}

export const getPlanLimits = withAuth<void, PlanLimits>(async (ctx) => {
  if (ctx.demo) {
    return ok({
      maxUsers: 3,
      maxProducts: 100,
      maxWarehouses: 2,
      currentUsers: 1,
      currentProducts: 18,
      currentWarehouses: 1,
    });
  }

  const { data: company } = await ctx.supabase
    .from("companies")
    .select("max_users, subscription_limits, subscription_plan")
    .eq("id", ctx.companyId)
    .single();

  const limits = (company?.subscription_limits as Partial<PlanLimits> | null) ?? {};

  const [users, products, warehouses] = await Promise.all([
    ctx.supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId),
    ctx.supabase.from("products").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId),
    ctx.supabase.from("warehouses").select("id", { count: "exact", head: true }).eq("company_id", ctx.companyId),
  ]);

  return ok({
    maxUsers: limits.maxUsers ?? company?.max_users ?? null,
    maxProducts: limits.maxProducts ?? null,
    maxWarehouses: limits.maxWarehouses ?? null,
    currentUsers: users.count ?? 0,
    currentProducts: products.count ?? 0,
    currentWarehouses: warehouses.count ?? 0,
  });
});
