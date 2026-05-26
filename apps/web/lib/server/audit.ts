"use server";

import { prisma } from "@/lib/prisma";
import type { AuthCtx } from "./with-auth";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "reject"
  | "close";

export interface AuditEntry {
  id: string;
  userId: string | null;
  action: AuditAction;
  tableName: string;
  recordId: string | null;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Append an audit_log row. Server-actions call this *after* a successful
 * mutation. Failures are logged but do not roll back the parent action —
 * audit-trail availability is best-effort.
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
  try {
    await prisma.auditLog.create({
      data: {
        companyId: ctx.companyId,
        userId: ctx.userId,
        action: args.action,
        tableName: args.table,
        recordId: args.recordId,
        oldData: (args.oldData ?? null) as never,
        newData: (args.newData ?? null) as never,
      },
    });
  } catch {
    // swallow — audit must never break the write path
  }
}
