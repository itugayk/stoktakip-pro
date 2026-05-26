"use server";

import type { Prisma } from "@prisma/client";
import {
  withAuth,
  withCompany,
  ok,
  parseInput,
  z,
  ERR,
  logAudit,
} from "@/lib/server";

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskEntityType =
  | "product"
  | "purchase_order"
  | "sales_order"
  | "count"
  | "return";

export interface Task {
  id: string;
  title: string;
  description?: string;
  entityType?: string;
  entityId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  assigneeName?: string;
  dueAt?: string;
  createdBy: string;
  creatorName?: string;
  completedAt?: string;
  createdAt: string;
}

const filterSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(),
  assignedTo: z.string().optional(),
  mine: z.boolean().optional(),
});

const upsertSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Başlık zorunlu"),
  description: z.string().optional(),
  entityType: z
    .enum(["product", "purchase_order", "sales_order", "count", "return"])
    .optional(),
  entityId: z.string().optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).default("open"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assignedTo: z.string().optional(),
  dueAt: z.string().optional(),
});

export const listTasks = withAuth<
  z.input<typeof filterSchema> | undefined,
  Task[]
>(async (ctx, raw) => {
  const filter = parseInput(filterSchema, raw ?? {});

  const where: Prisma.TaskWhereInput = { companyId: ctx.companyId };
  if (filter.status) where.status = filter.status;
  if (filter.assignedTo) where.assignedToId = filter.assignedTo;
  if (filter.mine) where.assignedToId = ctx.userId;

  const rows = await ctx.prisma.task.findMany({
    where,
    orderBy: [
      { dueAt: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    include: {
      assignedTo: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
    },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description ?? undefined,
      entityType: r.entityType ?? undefined,
      entityId: r.entityId ?? undefined,
      status: r.status as TaskStatus,
      priority: r.priority as TaskPriority,
      assignedTo: r.assignedToId ?? undefined,
      assigneeName: r.assignedTo?.fullName,
      dueAt: r.dueAt?.toISOString().slice(0, 10) ?? undefined,
      createdBy: r.createdById,
      creatorName: r.createdBy?.fullName,
      completedAt: r.completedAt?.toISOString() ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

export const upsertTask = withCompany<
  z.input<typeof upsertSchema>,
  { id: string }
>(async (ctx, raw) => {
  const data = parseInput(upsertSchema, raw);

  const baseData = {
    title: data.title,
    description: data.description ?? null,
    entityType: data.entityType ?? null,
    entityId: data.entityId ?? null,
    status: data.status,
    priority: data.priority,
    assignedToId: data.assignedTo ?? null,
    dueAt: data.dueAt ? new Date(data.dueAt) : null,
    completedAt: data.status === "done" ? new Date() : null,
  };

  let taskId: string;
  if (data.id) {
    const exists = await ctx.prisma.task.findFirst({
      where: { id: data.id, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!exists) throw ERR.notFound("Görev");

    await ctx.prisma.task.update({
      where: { id: data.id },
      data: baseData,
    });
    taskId = data.id;
    await logAudit(ctx, {
      action: "update",
      table: "tasks",
      recordId: data.id,
      newData: baseData as unknown as Record<string, unknown>,
    });
  } else {
    const row = await ctx.prisma.task.create({
      data: {
        ...baseData,
        companyId: ctx.companyId,
        createdById: ctx.userId,
      },
      select: { id: true },
    });
    taskId = row.id;
    await logAudit(ctx, {
      action: "create",
      table: "tasks",
      recordId: row.id,
      newData: baseData as unknown as Record<string, unknown>,
    });
  }

  // Notify assignee (if not self).
  if (data.assignedTo && data.assignedTo !== ctx.userId) {
    await ctx.prisma.notification.create({
      data: {
        companyId: ctx.companyId,
        userId: data.assignedTo,
        type: "system",
        title: "Yeni görev atandı",
        message: data.title,
        metadata: { taskId },
      },
    });
  }

  return ok({ id: taskId });
});

export const deleteTask = withCompany<string, void>(async (ctx, id) => {
  const res = await ctx.prisma.task.deleteMany({
    where: { id, companyId: ctx.companyId },
  });
  if (res.count === 0) throw ERR.notFound("Görev");
  return ok();
});

const statusSchema = z.object({
  id: z.string(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
});

export const updateTaskStatus = withAuth<z.input<typeof statusSchema>, void>(
  async (ctx, raw) => {
    const { id, status } = parseInput(statusSchema, raw);
    const res = await ctx.prisma.task.updateMany({
      where: { id, companyId: ctx.companyId },
      data: {
        status,
        completedAt: status === "done" ? new Date() : null,
      },
    });
    if (res.count === 0) throw ERR.notFound("Görev");
    return ok();
  }
);
