"use client";

import { useEffect, useState } from "react";
import { Activity, Plus, Pencil, Trash2, CheckCircle2, XCircle, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActivityFeed, type ActivityEntry } from "@/lib/actions";

const ICONS = {
  create: { Icon: Plus, color: "text-emerald-500" },
  update: { Icon: Pencil, color: "text-blue-500" },
  delete: { Icon: Trash2, color: "text-rose-500" },
  approve: { Icon: CheckCircle2, color: "text-emerald-500" },
  reject: { Icon: XCircle, color: "text-rose-500" },
  close: { Icon: Lock, color: "text-muted-foreground" },
} as const;

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActivityFeed({ limit }).then((r) => {
      if (r.ok) setEntries(r.data);
      setLoading(false);
    });
  }, [limit]);

  if (!loading && entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Son Aktiviteler
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <ol className="space-y-2">
            {entries.map((e) => {
              const meta = ICONS[e.action as keyof typeof ICONS] ?? ICONS.update;
              const Icon = meta.Icon;
              return (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted ${meta.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{e.summary}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString("tr-TR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
