"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ClipboardList, CheckCircle2, Circle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import { listCounts, type StockCount, type CountStatus } from "@/lib/actions";

const STATUS_META: Record<CountStatus, { label: string; icon: typeof Circle; color: string }> = {
  open: { label: "Açık", icon: Circle, color: "text-muted-foreground" },
  in_progress: { label: "Devam ediyor", icon: Clock, color: "text-blue-500" },
  review: { label: "İnceleme", icon: Clock, color: "text-amber-500" },
  closed: { label: "Kapalı", icon: CheckCircle2, color: "text-emerald-500" },
  cancelled: { label: "İptal", icon: Circle, color: "text-rose-500" },
};

export default function CountsPage() {
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCounts().then((r) => {
      if (r.ok) setCounts(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Stok Sayımları"
        description={`${counts.length} sayım`}
        actions={
          <Button asChild>
            <Link href="/dashboard/counts/new">
              <Plus className="mr-2 h-4 w-4" />
              Yeni Sayım
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : counts.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Henüz sayım yok"
              description="Stoklarınızı doğrulamak için bir sayım başlatın."
              cta={
                <Button asChild>
                  <Link href="/dashboard/counts/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Yeni Sayım Başlat
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sayım</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İlerleme</TableHead>
                  <TableHead>Başlangıç</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {counts.map((c) => {
                  const meta = STATUS_META[c.status];
                  const Icon = meta.icon;
                  const pct = c.itemCount > 0 ? Math.round((c.scannedCount / c.itemCount) * 100) : 0;
                  return (
                    <TableRow key={c.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Link href={`/dashboard/counts/${c.id}`} className="font-medium hover:underline">
                          {c.name || `Sayım ${c.id.slice(0, 8)}`}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          <Icon className={`mr-1 h-3 w-3 ${meta.color}`} />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.scannedCount}/{c.itemCount} ({pct}%)
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(c.startedAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
