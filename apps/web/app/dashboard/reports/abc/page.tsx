"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import { runABCAnalysis, type ABCResult } from "@/lib/actions";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

const CLASS_COLORS = { A: "#22c55e", B: "#f59e0b", C: "#ef4444" } as const;

export default function ABCPage() {
  const [result, setResult] = useState<ABCResult | null>(null);
  const [period, setPeriod] = useState<"30d" | "90d" | "1y">("90d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    runABCAnalysis({ period }).then((r) => {
      if (r.ok) setResult(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  }, [period]);

  const chartData = result
    ? [
        { name: "A (cironun %80)", value: result.totals.aCount, fill: CLASS_COLORS.A },
        { name: "B (sonraki %15)", value: result.totals.bCount, fill: CLASS_COLORS.B },
        { name: "C (kalan %5)", value: result.totals.cCount, fill: CLASS_COLORS.C },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="ABC Analizi"
        description="Pareto: Cironun %80'ini sağlayan ürünler A sınıfı"
        breadcrumb={[{ label: "Raporlar", href: "/dashboard/reports" }, { label: "ABC Analizi" }]}
        actions={
          <Select value={period} onValueChange={(v) => v && setPeriod(v as typeof period)}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Son 30 Gün</SelectItem>
              <SelectItem value="90d">Son 90 Gün</SelectItem>
              <SelectItem value="1y">Son 1 Yıl</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : !result || result.rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title="Satış verisi yok" description={`Son ${period} satış hareketi bulunamadı.`} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardContent className="p-4 space-y-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Toplam Ciro</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(result.totals.revenue)}</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      label
                    >
                      {chartData.map((d) => (
                        <Cell key={d.name} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ürün</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead className="text-right">Ciro</TableHead>
                    <TableHead className="text-right">Kümülatif %</TableHead>
                    <TableHead className="text-center">Sınıf</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((r) => (
                    <TableRow key={r.productId}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{r.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{r.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.unitsSold}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.revenue)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {(r.cumulativeShare * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          style={{
                            backgroundColor: `${CLASS_COLORS[r.abc]}1f`,
                            color: CLASS_COLORS[r.abc],
                            borderColor: `${CLASS_COLORS[r.abc]}4d`,
                          }}
                          className="text-xs font-bold"
                          variant="outline"
                        >
                          {r.abc}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
