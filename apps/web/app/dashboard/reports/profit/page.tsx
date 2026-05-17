"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import { getProfitReport, type ProfitReport, type CostMethod } from "@/lib/actions";
import { generateReportPdf } from "@/lib/pdf/report-pdf";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
const formatPct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function ProfitReportPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<CostMethod>("AVG");
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(false);

  const run = () => {
    setLoading(true);
    getProfitReport({ from, to, method }).then((r) => {
      if (r.ok) setReport(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadPdf = () => {
    if (!report) return;
    generateReportPdf({
      title: "Kar / Zarar Raporu",
      subtitle: `Maliyet yöntemi: ${method}`,
      period: `${from} — ${to}`,
      company: { name: "StokTakip Pro" },
      summary: [
        { label: "Ciro", value: formatCurrency(report.totals.revenue) },
        { label: "Maliyet", value: formatCurrency(report.totals.cogs) },
        { label: "Brüt Kar", value: formatCurrency(report.totals.grossProfit) },
        { label: "Marj", value: formatPct(report.totals.grossMarginPct) },
      ],
      columns: ["Ürün", "SKU", "Adet", "Ciro", "Maliyet", "Brüt Kar", "Marj"],
      rows: report.rows.map((r) => [
        r.name,
        r.sku,
        r.unitsSold,
        formatCurrency(r.revenue),
        formatCurrency(r.cogs),
        formatCurrency(r.grossProfit),
        formatPct(r.grossMarginPct),
      ]),
      columnAlign: ["left", "left", "right", "right", "right", "right", "right"],
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Kar / Zarar Analizi"
        description="Ürün bazlı brüt kâr — satış - maliyet"
        breadcrumb={[{ label: "Raporlar", href: "/dashboard/reports" }, { label: "Kar/Zarar" }]}
        actions={
          <Button variant="outline" onClick={downloadPdf} disabled={!report || report.rows.length === 0}>
            <FileDown className="mr-2 h-4 w-4" />
            PDF İndir
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="grid gap-1">
            <Label className="text-xs">Başlangıç</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Bitiş</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Maliyet Yöntemi</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v as CostMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AVG">Ortalama (AVG)</SelectItem>
                <SelectItem value="FIFO">FIFO</SelectItem>
                <SelectItem value="LIFO">LIFO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={run} disabled={loading}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Çalıştır
          </Button>
        </CardContent>
      </Card>

      {report && report.rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Ciro</p>
              <p className="text-xl font-bold tabular-nums mt-1">{formatCurrency(report.totals.revenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Maliyet</p>
              <p className="text-xl font-bold tabular-nums mt-1">{formatCurrency(report.totals.cogs)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Brüt Kar</p>
              <p
                className={`text-xl font-bold tabular-nums mt-1 ${
                  report.totals.grossProfit < 0 ? "text-rose-500" : "text-emerald-500"
                }`}
              >
                {formatCurrency(report.totals.grossProfit)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Marj</p>
              <p className="text-xl font-bold tabular-nums mt-1">{formatPct(report.totals.grossMarginPct)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <Card><CardContent className="p-6 space-y-2">
          {[1, 2, 3].map((i) => (<div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />))}
        </CardContent></Card>
      ) : !report || report.rows.length === 0 ? (
        <Card><CardContent><EmptyState title="Veri yok" description="Bu aralıkta satış hareketi bulunamadı." /></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead className="text-right">Adet</TableHead>
                  <TableHead className="text-right">Ciro</TableHead>
                  <TableHead className="text-right">Maliyet</TableHead>
                  <TableHead className="text-right">Brüt Kar</TableHead>
                  <TableHead className="text-right">Marj</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((r) => (
                  <TableRow key={r.productId} className={r.grossProfit < 0 ? "bg-rose-500/5" : ""}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{r.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.unitsSold}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(r.cogs)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      <span className={r.grossProfit < 0 ? "text-rose-500" : "text-emerald-500"}>
                        {formatCurrency(r.grossProfit)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="tabular-nums">{formatPct(r.grossMarginPct)}</Badge>
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
