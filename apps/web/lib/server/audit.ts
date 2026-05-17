"use server";

import type { AuthCtx } from "./with-auth";

export type AuditAction = "create" | "update" | "delete" | "approve" | "reject" | "close";

export interface AuditEntry {
  id: string;
  userId: string | null;
  action: AuditAction;
  tableName: string;
  recordId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Append an audit_log row. Server-actions call this *after* a successful
 * mutation. Failures are logged but do not roll back the parent action —
 * audit-trail availability is best-effort.
 *
 * Skips when ctx.demo is true.
 */
export async function logAudit(
  ctx: AuthCtx,
  args: {
    action: AuditAction;
    table: string;
    recordId: string;
    oldData?: Record<string, unknown>;
    newData?: Record<string, unknown>;
  }
): Promise<void> {
  if (ctx.demo) return;

  try {
    await ctx.supabase.from("audit_log").insert({
      company_id: ctx.companyId,
      user_id: ctx.userId,
      action: args.action,
      table_name: args.table,
      record_id: args.recordId,
      old_data: args.oldData ?? null,
      new_data: args.newData ?? null,
    } as never);
  } catch {
    // swallow — audit must never break the write path
  }
}
