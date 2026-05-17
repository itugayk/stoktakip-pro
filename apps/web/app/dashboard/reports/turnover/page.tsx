"use client";

import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import { getInventoryTurnover, type TurnoverRow } from "@/lib/actions";

export default function TurnoverPage() {
  const [rows, setRows] = useState<TurnoverRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInventoryTurnover().then((r) => {
      if (r.ok) setRows(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Stok Devir Hızı"
        description={`${rows.length} ürün — son 30 / 60 / 90 günlük çıkış / ortalama stok`}
        breadcrumb={[{ label: "Raporlar", href: "/dashboard/reports" }, { label: "Devir Hızı" }]}
      />

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ürün ara…"
              className="pl-9"
              enterKeyHint="search"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title="Hareket verisi yok" description="Devir hızı için satış / çıkış hareketi olmalı." />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead className="text-right">Çıkış 30g</TableHead>
                  <TableHead className="text-right">Çıkış 90g</TableHead>
                  <TableHead className="text-right">Ort. Stok</TableHead>
                  <TableHead className="text-right">Devir 30g</TableHead>
                  <TableHead className="text-right">Hız</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const isSlow = r.turnover30d < 0.2;
                  const isFast = r.turnover30d > 1.5;
                  return (
                    <TableRow key={r.productId} className={isSlow ? "bg-rose-500/5" : ""}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{r.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{r.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.out30d}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.out90d}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.avgStock.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {r.turnover30d.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isFast ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
                            <TrendingUp className="mr-1 h-3 w-3" />
                            Hızlı
                          </Badge>
                        ) : isSlow ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <TrendingDown className="mr-1 h-3 w-3" />
                            Yavaş
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Normal</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
