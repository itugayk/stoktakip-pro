"use server";

import { withAuth, ok, parseInput, z, ERR } from "@/lib/server";
import type { AuditEntry } from "@/lib/server";

const querySchema = z.object({
  table: z.string(),
  recordId: z.string(),
  limit: z.number().int().positive().max(200).optional(),
});

export interface AuditLogEntry extends AuditEntry {
  userName?: string;
}

export const getAuditTrail = withAuth<z.input<typeof querySchema>, AuditLogEntry[]>(
  async (ctx, raw) => {
    const { table, recordId, limit = 50 } = parseInput(querySchema, raw);
    if (ctx.demo) return ok([]);

    const { data, error } = await ctx.supabase
      .from("audit_log")
      .select(`
        id, user_id, action, table_name, record_id, old_data, new_data, created_at,
        user:profiles!audit_log_user_id_fkey(full_name)
      `)
      .eq("table_name", table)
      .eq("record_id", recordId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw ERR.database(error.message);

    return ok(
      (data ?? []).map((r) => {
        const user = r.user as { full_name: string } | { full_name: string }[] | null;
        const userName = Array.isArray(user) ? user[0]?.full_name : user?.full_name;
        return {
          id: r.id,
          userId: r.user_id,
          action: r.action as AuditLogEntry["action"],
          tableName: r.table_name,
          recordId: r.record_id,
          oldData: (r.old_data as Record<string, unknown>) ?? undefined,
          newData: (r.new_data as Record<string, unknown>) ?? undefined,
          createdAt: r.created_at,
          userName,
        };
      })
    );
  }
);
