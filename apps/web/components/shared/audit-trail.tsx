"use client";

import { useEffect, useState } from "react";
import { Clock, User, Plus, Pencil, Trash2, CheckCircle2, XCircle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAuditTrail, type AuditLogEntry } from "@/lib/actions";
import { EmptyState } from "./empty-state";

export interface AuditTrailProps {
  /** Table name in audit_log (e.g. "products"). */
  table: string;
  /** Row id whose history to render. */
  recordId: string;
}

const ACTION_META: Record<
  AuditLogEntry["action"],
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  create: { label: "Oluşturuldu", icon: Plus, color: "text-emerald-500" },
  update: { label: "Güncellendi", icon: Pencil, color: "text-blue-500" },
  delete: { label: "Silindi", icon: Trash2, color: "text-rose-500" },
  approve: { label: "Onaylandı", icon: CheckCircle2, color: "text-emerald-500" },
  reject: { label: "Reddedildi", icon: XCircle, color: "text-rose-500" },
  close: { label: "Kapatıldı", icon: Lock, color: "text-muted-foreground" },
};

/**
 * Reusable timeline of audit_log rows for any (table, recordId). Renders a
 * diff for `update` rows with `oldData` + `newData`.
 */
export function AuditTrail({ table, recordId }: AuditTrailProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditTrail({ table, recordId, limit: 100 }).then((r) => {
      if (r.ok) setEntries(r.data);
      setLoading(false);
    });
  }, [table, recordId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="Henüz değişiklik yok"
        description="Bu kayıt üzerindeki tüm değişiklikler burada görünecek."
      />
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((e) => {
        const meta = ACTION_META[e.action] ?? ACTION_META.update;
        const Icon = meta.icon;
        const diff = e.action === "update" ? diffFields(e.oldData, e.newData) : [];
        return (
          <li key={e.id} className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-muted ${meta.color}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 w-px bg-border" />
            </div>
            <div className="flex-1 pb-4 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {e.userName ?? "Sistem"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString("tr-TR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {diff.length > 0 && (
                <div className="mt-2 rounded-md border border-border bg-muted/30 p-2 space-y-1">
                  {diff.map((d) => (
                    <div key={d.field} className="text-xs font-mono">
                      <span className="text-muted-foreground">{d.field}: </span>
                      <span className="text-rose-500 line-through">{formatVal(d.old)}</span>{" "}
                      <span className="text-emerald-500">{formatVal(d.next)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function diffFields(
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>
): { field: string; old: unknown; next: unknown }[] {
  if (!oldData || !newData) return [];
  const result: { field: string; old: unknown; next: unknown }[] = [];
  for (const key of Object.keys(newData)) {
    if (oldData[key] !== newData[key]) {
      result.push({ field: key, old: oldData[key], next: newData[key] });
    }
  }
  return result.slice(0, 8);
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
