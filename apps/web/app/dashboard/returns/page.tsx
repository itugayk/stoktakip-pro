"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Undo2, CheckCircle2, Clock, XCircle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import { listReturns, approveReturn, receiveReturn, type Return, type ReturnStatus } from "@/lib/actions";

const STATUS_META: Record<ReturnStatus, { label: string; color: string }> = {
  pending: { label: "Onay bekliyor", color: "text-amber-500" },
  approved: { label: "Onaylandı", color: "text-blue-500" },
  received: { label: "Teslim alındı", color: "text-emerald-500" },
  rejected: { label: "Reddedildi", color: "text-rose-500" },
  cancelled: { label: "İptal", color: "text-muted-foreground" },
};

export default function ReturnsPage() {
  const [items, setItems] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    listReturns(undefined).then((r) => {
      if (r.ok) setItems(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  };

  useEffect(refresh, []);

  const handleApprove = async (id: string) => {
    const r = await approveReturn({ returnId: id });
    if (r.ok) {
      toast.success("İade onaylandı");
      refresh();
    } else toast.error(r.error.message);
  };

  const handleReceive = async (id: string) => {
    const r = await receiveReturn({ returnId: id });
    if (r.ok) {
      toast.success(`Stoğa eklendi (${r.data.movementsCreated} hareket)`);
      refresh();
    } else toast.error(r.error.message);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="İadeler"
        description={`${items.length} iade kaydı`}
        actions={
          <Button asChild>
            <Link href="/dashboard/returns/new">
              <Plus className="mr-2 h-4 w-4" />
              Yeni İade
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
          ) : items.length === 0 ? (
            <EmptyState
              icon={Undo2}
              title="Henüz iade yok"
              description="Müşteri veya tedarikçi iadelerinizi buradan yönetin."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Sebep</TableHead>
                  <TableHead className="text-right">Kalem</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {r.type === "customer" ? "Müşteri" : "Tedarikçi"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {r.reason ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.items.length}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => handleApprove(r.id)}>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Onayla
                          </Button>
                        )}
                        {r.status === "approved" && (
                          <Button size="sm" onClick={() => handleReceive(r.id)}>
                            <Truck className="mr-1 h-3.5 w-3.5" />
                            Teslim Al
                          </Button>
                        )}
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
