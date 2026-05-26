"use server";

import { withAuth, ok, parseInput, z } from "@/lib/server";
import type { AuditEntry } from "@/lib/server";

const querySchema = z.object({
  table: z.string(),
  recordId: z.string(),
  limit: z.number().int().positive().max(200).optional(),
});

export interface AuditLogEntry extends AuditEntry {
  userName?: string;
}

export const getAuditTrail = withAuth<
  z.input<typeof querySchema>,
  AuditLogEntry[]
>(async (ctx, raw) => {
  const { table, recordId, limit = 50 } = parseInput(querySchema, raw);

  const rows = await ctx.prisma.auditLog.findMany({
    where: {
      companyId: ctx.companyId,
      tableName: table,
      recordId,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { fullName: true } } },
  });

  return ok(
    rows.map<AuditLogEntry>((r) => ({
      id: r.id,
      userId: r.userId,
      action: r.action as AuditLogEntry["action"],
      tableName: r.tableName,
      recordId: r.recordId,
      oldData: (r.oldData as Record<string, unknown>) ?? undefined,
      newData: (r.newData as Record<string, unknown>) ?? undefined,
      createdAt: r.createdAt.toISOString(),
      userName: r.user?.fullName,
    }))
  );
});
