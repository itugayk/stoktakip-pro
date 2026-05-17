"use server";

import { withAuth, withCompany, ok, parseInput, z, ERR, logAudit } from "@/lib/server";

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

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
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]).default("open"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assignedTo: z.string().optional(),
  dueAt: z.string().optional(),
});

export const listTasks = withAuth<z.input<typeof filterSchema> | undefined, Task[]>(
  async (ctx, raw) => {
    const filter = parseInput(filterSchema, raw ?? {});
    if (ctx.demo) return ok([]);

    let q = ctx.supabase
      .from("tasks")
      .select(`
        *,
        assignee:profiles!tasks_assigned_to_fkey(full_name),
        creator:profiles!tasks_created_by_fkey(full_name)
      `)
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (filter.status) q = q.eq("status", filter.status);
    if (filter.assignedTo) q = q.eq("assigned_to", filter.assignedTo);
    if (filter.mine) q = q.eq("assigned_to", ctx.userId);

    const { data, error } = await q;
    if (error) throw ERR.database(error.message);

    return ok(
      (data ?? []).map((r) => {
        const aRaw = r.assignee as { full_name: string } | { full_name: string }[] | null;
        const cRaw = r.creator as { full_name: string } | { full_name: string }[] | null;
        const assignee = Array.isArray(aRaw) ? aRaw[0] : aRaw;
        const creator = Array.isArray(cRaw) ? cRaw[0] : cRaw;
        return {
          id: r.id,
          title: r.title,
          description: r.description ?? undefined,
          entityType: r.entity_type ?? undefined,
          entityId: r.entity_id ?? undefined,
          status: r.status as TaskStatus,
          priority: r.priority as TaskPriority,
          assignedTo: r.assigned_to ?? undefined,
          assigneeName: assignee?.full_name,
          dueAt: r.due_at ?? undefined,
          createdBy: r.created_by,
          creatorName: creator?.full_name,
          completedAt: r.completed_at ?? undefined,
          createdAt: r.created_at,
        };
      })
    );
  }
);

export const upsertTask = withCompany<z.input<typeof upsertSchema>, { id: string }>(
  async (ctx, raw) => {
    const data = parseInput(upsertSchema, raw);
    if (ctx.demo) return ok({ id: data.id ?? `t-${Date.now()}` });

    const payload = {
      title: data.title,
      description: data.description ?? null,
      entity_type: data.entityType ?? null,
      entity_id: data.entityId ?? null,
      status: data.status,
      priority: data.priority,
      assigned_to: data.assignedTo ?? null,
      due_at: data.dueAt ?? null,
      completed_at: data.status === "done" ? new Date().toISOString() : null,
    };

    if (data.id) {
      const { error } = await ctx.supabase.from("tasks").update(payload).eq("id", data.id);
      if (error) throw ERR.database(error.message);

      await logAudit(ctx, { action: "update", table: "tasks", recordId: data.id, newData: payload });

      // If the task was just assigned, notify the assignee.
      if (data.assignedTo && data.assignedTo !== ctx.userId) {
        await ctx.supabase.from("notifications").insert({
          company_id: ctx.companyId,
          user_id: data.assignedTo,
          type: "system",
          title: "Yeni görev atandı",
          message: data.title,
          metadata: { taskId: data.id },
        } as never);
      }
      return ok({ id: data.id });
    }

    const { data: row, error } = await ctx.supabase
      .from("tasks")
      .insert({ ...payload, company_id: ctx.companyId, created_by: ctx.userId } as never)
      .select("id")
      .single();
    if (error) throw ERR.database(error.message);

    await logAudit(ctx, { action: "create", table: "tasks", recordId: row.id, newData: payload });

    if (data.assignedTo && data.assignedTo !== ctx.userId) {
      await ctx.supabase.from("notifications").insert({
        company_id: ctx.companyId,
        user_id: data.assignedTo,
        type: "system",
        title: "Yeni görev atandı",
        message: data.title,
        metadata: { taskId: row.id },
      } as never);
    }
    return ok({ id: row.id });
  }
);

export const deleteTask = withCompany<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase.from("tasks").delete().eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});

const statusSchema = z.object({
  id: z.string(),
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
});

export const updateTaskStatus = withAuth<z.input<typeof statusSchema>, void>(async (ctx, raw) => {
  const { id, status } = parseInput(statusSchema, raw);
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase
    .from("tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});
