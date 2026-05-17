"use client";

import { useEffect, useState } from "react";
import { Package, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import { getDeadStock, type DeadStockRow } from "@/lib/actions";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

export default function DeadStockPage() {
  const [rows, setRows] = useState<DeadStockRow[]>([]);
  const [days, setDays] = useState<number>(90);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDeadStock({ days }).then((r) => {
      if (r.ok) setRows(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  }, [days]);

  const totalValue = rows.reduce((sum, r) => sum + r.stockValue, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Ölü Stok"
        description={`${days} gündür hareket görmemiş ${rows.length} ürün`}
        breadcrumb={[{ label: "Raporlar", href: "/dashboard/reports" }, { label: "Ölü Stok" }]}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Eşik:</span>
            <Select value={String(days)} onValueChange={(v) => v && setDays(Number(v))}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 gün</SelectItem>
                <SelectItem value="60">60 gün</SelectItem>
                <SelectItem value="90">90 gün</SelectItem>
                <SelectItem value="180">180 gün</SelectItem>
                <SelectItem value="365">1 yıl</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10">
              <Package className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Ölü Stok Sayısı</p>
              <p className="text-xl font-bold tabular-nums">{rows.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Wallet className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Bağlı Değer</p>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(totalValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Button variant="outline" size="sm" disabled className="opacity-60 ml-auto">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              İndirim kampanyası öner (Faz 8)
            </Button>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Package}
              title="Ölü stok yok"
              description={`Son ${days} gün içinde tüm ürünlerde hareket olmuş.`}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead className="text-right">Bağlı Değer</TableHead>
                  <TableHead className="text-right">İdle</TableHead>
                  <TableHead>Son Hareket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.productId}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{r.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.currentStock} <span className="text-xs text-muted-foreground">{r.unit}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.stockValue)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.daysIdle > 180 ? "destructive" : "secondary"} className="tabular-nums">
                        {r.daysIdle} gün
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.lastOutAt
                        ? new Date(r.lastOutAt).toLocaleDateString("tr-TR")
                        : "Hiç"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
