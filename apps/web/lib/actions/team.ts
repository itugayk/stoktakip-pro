"use server";

import {
  withAuth,
  withRole,
  ok,
  fail,
  parseInput,
  z,
  ERR,
  logAudit,
} from "@/lib/server";
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

export const getActivityFeed = withAuth<
  z.input<typeof activitySchema> | undefined,
  ActivityEntry[]
>(async (ctx, raw) => {
  const { limit = 20 } = parseInput(activitySchema, raw ?? {});

  const rows = await ctx.prisma.auditLog.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { fullName: true } } },
  });

  return ok(
    rows.map((r) => {
      const actionLabel = ACTION_LABELS[r.action] ?? r.action;
      const tableLabel = TABLE_LABELS[r.tableName] ?? r.tableName;
      return {
        id: r.id,
        action: r.action,
        tableName: r.tableName,
        recordId: r.recordId ?? undefined,
        userId: r.userId ?? undefined,
        userName: r.user?.fullName,
        createdAt: r.createdAt.toISOString(),
        summary: `${r.user?.fullName ?? "Sistem"} bir ${tableLabel} ${actionLabel}`,
      };
    })
  );
});

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
  const rows = await ctx.prisma.user.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
      warehouseIds: true,
      lastLoginAt: true,
    },
  });

  return ok(
    rows.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      warehouseIds: u.warehouseIds ?? [],
      lastLoginAt: u.lastLoginAt?.toISOString() ?? undefined,
    }))
  );
});

const updateMemberSchema = z.object({
  userId: z.string(),
  role: z.enum(["admin", "manager", "warehouse_staff", "viewer"]).optional(),
  warehouseIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const updateTeamMember = withRole<
  z.input<typeof updateMemberSchema>,
  void
>(["admin"], async (ctx, raw) => {
  const data = parseInput(updateMemberSchema, raw);

  if (data.userId === ctx.userId && data.role && data.role !== "admin") {
    return fail("self_demote", "Kendi rolünüzü admin'den düşüremezsiniz");
  }

  // Verify the target user belongs to this company before updating.
  const target = await ctx.prisma.user.findFirst({
    where: { id: data.userId, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!target) throw ERR.notFound("Kullanıcı");

  const update: {
    role?: UserRole;
    warehouseIds?: string[];
    isActive?: boolean;
  } = {};
  if (data.role) update.role = data.role;
  if (data.warehouseIds) update.warehouseIds = data.warehouseIds;
  if (data.isActive !== undefined) update.isActive = data.isActive;

  await ctx.prisma.user.update({
    where: { id: data.userId },
    data: update,
  });

  await logAudit(ctx, {
    action: "update",
    table: "users",
    recordId: data.userId,
    newData: update as Record<string, unknown>,
  });
  return ok();
});

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
  const company = await ctx.prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: {
      maxUsers: true,
      subscriptionLimits: true,
      subscriptionPlan: true,
    },
  });

  const limits =
    (company?.subscriptionLimits as Partial<PlanLimits> | null) ?? {};

  const [users, products, warehouses] = await Promise.all([
    ctx.prisma.user.count({ where: { companyId: ctx.companyId } }),
    ctx.prisma.product.count({ where: { companyId: ctx.companyId } }),
    ctx.prisma.warehouse.count({ where: { companyId: ctx.companyId } }),
  ]);

  return ok({
    maxUsers: limits.maxUsers ?? company?.maxUsers ?? null,
    maxProducts: limits.maxProducts ?? null,
    maxWarehouses: limits.maxWarehouses ?? null,
    currentUsers: users,
    currentProducts: products,
    currentWarehouses: warehouses,
  });
});
