"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import { getRevenueTrend, getPeriodComparison, type TrendPoint, type PeriodComparison } from "@/lib/actions";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
const formatPct = (n: number) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

export default function TrendsReportPage() {
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");
  const [days, setDays] = useState(90);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getRevenueTrend({ days }), getPeriodComparison({ period })]).then(([t, c]) => {
      if (t.ok) setTrend(t.data);
      else toast.error(t.error.message);
      if (c.ok) setComparison(c.data);
      else toast.error(c.error.message);
      setLoading(false);
    });
  }, [days, period]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Trend & Karşılaştırma"
        description="Günlük ciro / adet zaman serisi + dönem karşılaştırma"
        breadcrumb={[{ label: "Raporlar", href: "/dashboard/reports" }, { label: "Trend" }]}
        actions={
          <Select value={period} onValueChange={(v) => v && setPeriod(v as typeof period)}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Aylık</SelectItem>
              <SelectItem value="quarter">Çeyreklik</SelectItem>
              <SelectItem value="year">Yıllık</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Comparison tiles */}
      {comparison && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { key: "revenue", label: "Ciro", format: formatCurrency },
            { key: "cost", label: "Maliyet", format: formatCurrency },
            { key: "orders", label: "Sipariş", format: (n: number) => n.toString() },
            { key: "units", label: "Adet", format: (n: number) => n.toString() },
          ].map((m) => {
            const curr = comparison.current[m.key as keyof typeof comparison.current] as number;
            const pct = comparison.deltaPct[m.key as keyof typeof comparison.deltaPct] as number;
            const up = pct > 0;
            return (
              <Card key={m.key}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</p>
                  <p className="text-xl font-bold tabular-nums mt-1">{m.format(curr)}</p>
                  <p
                    className={`text-xs mt-1 tabular-nums ${
                      up ? "text-emerald-500" : pct < 0 ? "text-rose-500" : "text-muted-foreground"
                    }`}
                  >
                    {formatPct(pct)} <span className="text-muted-foreground">(önceki dönem)</span>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Ciro & Adet Trendi</h3>
            <Select value={String(days)} onValueChange={(v) => v && setDays(Number(v))}>
              <SelectTrigger className="h-8 w-[120px]">
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
          {loading ? (
            <div className="h-72 rounded bg-muted/50 animate-pulse" />
          ) : trend.length === 0 ? (
            <EmptyState title="Veri yok" description="Bu aralıkta satış hareketi bulunamadı." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="g-revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(252, 87%, 58%)" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="hsl(252, 87%, 58%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(d) => new Date(String(d)).toLocaleDateString("tr-TR")}
                    formatter={(value, name) => {
                      const v = typeof value === "number" ? value : Number(value);
                      const isRevenue = name === "revenue" || name === "Ciro";
                      return [isRevenue ? formatCurrency(v) : v, isRevenue ? "Ciro" : "Adet"];
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Ciro"
                    stroke="hsl(252, 87%, 58%)"
                    fill="url(#g-revenue)"
                  />
                  <Brush dataKey="date" height={20} stroke="hsl(252, 87%, 58%)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
