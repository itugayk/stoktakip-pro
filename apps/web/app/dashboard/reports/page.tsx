"use client";

import { useState, useMemo } from "react";
import {
  BarChart3, FileDown, TrendingUp, Package, CalendarClock,
  DollarSign, PieChart as PieChartIcon, ArrowUpRight,
  ArrowDownRight, FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Line, Legend, Area, AreaChart,
} from "recharts";
import { demoProducts, demoCategories, demoMovements, demoLots } from "@/lib/demo-data";
import { PageHeader } from "@/components/shared";

// Chart colors
const COLORS = [
  "hsl(252, 87%, 58%)", "hsl(142, 71%, 45%)", "hsl(330, 81%, 60%)",
  "hsl(38, 92%, 50%)", "hsl(188, 78%, 41%)", "hsl(262, 83%, 58%)",
  "hsl(350, 89%, 60%)", "hsl(168, 76%, 42%)",
];

type ChartTooltipPayload = {
  name?: string;
  value?: number | string;
  color?: string;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string | number;
}) {
  if (!active || !payload) return null;

  return (
    <div className="rounded-lg border border-border bg-popover p-3 shadow-xl">
      <p className="text-xs font-medium mb-1">{label}</p>
      {payload.map((item, i) => (
        <p key={i} className="text-xs" style={{ color: item.color }}>
          {item.name}:{" "}
          <span className="font-semibold">
            {typeof item.value === "number"
              ? item.value.toLocaleString("tr-TR")
              : item.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState("7d");

  // === Category Distribution ===
  const categoryData = useMemo(() => {
    const map = new Map<string, { name: string; count: number; stock: number; value: number }>();
    demoProducts.forEach((p) => {
      const cat = demoCategories.find((c) => c.id === p.categoryId);
      const key = p.categoryId;
      const existing = map.get(key) ?? { name: cat?.name ?? "Diğer", count: 0, stock: 0, value: 0 };
      existing.count += 1;
      existing.stock += p.currentStock;
      existing.value += p.currentStock * p.salePrice;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, []);

  // === Stock Status Distribution ===
  const stockStatusData = useMemo(() => {
    const statuses = { ok: 0, low: 0, critical: 0, overstock: 0 };
    demoProducts.forEach((p) => { statuses[p.stockStatus] += 1; });
    return [
      { name: "Normal", value: statuses.ok, fill: "hsl(142, 71%, 45%)" },
      { name: "Düşük", value: statuses.low, fill: "hsl(38, 92%, 50%)" },
      { name: "Kritik", value: statuses.critical, fill: "hsl(0, 84%, 60%)" },
      { name: "Fazla", value: statuses.overstock, fill: "hsl(217, 91%, 60%)" },
    ].filter((d) => d.value > 0);
  }, []);

  // === Movement Trend (last 7 days) ===
  const movementTrend = useMemo(() => {
    const days: { date: string; giriş: number; çıkış: number; transfer: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
      const dayMovs = demoMovements.filter((m) => m.createdAt.startsWith(dateStr));
      days.push({
        date: label,
        giriş: dayMovs.filter((m) => m.type === "in").reduce((s, m) => s + m.quantity, 0),
        çıkış: dayMovs.filter((m) => m.type === "out").reduce((s, m) => s + m.quantity, 0),
        transfer: dayMovs.filter((m) => m.type === "transfer").reduce((s, m) => s + m.quantity, 0),
      });
    }
    return days;
  }, []);

  // === Top Products by Stock Value ===
  const topProducts = useMemo(() => {
    return [...demoProducts]
      .map((p) => ({
        name: p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name,
        fullName: p.name,
        value: p.currentStock * p.salePrice,
        stock: p.currentStock,
        unit: p.unit,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, []);

  // === Expiry Overview ===
  const expiryData = useMemo(() => {
    const now = new Date();
    return demoLots
      .filter((l) => l.expiryDate)
      .map((l) => {
        const expiry = new Date(l.expiryDate!);
        const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { ...l, daysLeft: days };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, []);

  // === Summary Stats ===
  const totalStockValue = demoProducts.reduce((s, p) => s + p.currentStock * p.salePrice, 0);
  const totalPurchaseValue = demoProducts.reduce((s, p) => s + p.currentStock * p.purchasePrice, 0);
  const potentialProfit = totalStockValue - totalPurchaseValue;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);

  // === CSV Export ===
  const exportStockReport = () => {
    const headers = ["Ürün", "SKU", "Kategori", "Stok", "Birim", "Alış Fiyatı", "Satış Fiyatı", "Stok Değeri", "Durum"];
    const rows = demoProducts.map((p) => [
      p.name, p.sku, p.categoryName, p.currentStock, p.unit,
      p.purchasePrice, p.salePrice, (p.currentStock * p.salePrice).toFixed(2), p.stockStatus,
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stok_raporu_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Stok raporu indirildi");
  };

  const exportExpiryReport = () => {
    const headers = ["Ürün", "Lot No", "Miktar", "SKT", "Kalan Gün", "Depo"];
    const rows = expiryData.map((l) => [
      l.productName, l.lotNumber, l.quantity, l.expiryDate, l.daysLeft, l.warehouseName,
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `skt_raporu_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("SKT raporu indirildi");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Raporlar & Analiz"
        description="Stok durumu, hareketler ve finansal analiz"
        actions={
          <>
            <Select value={period} onValueChange={(value) => setPeriod(value ?? "7d")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Son 7 Gün</SelectItem>
                <SelectItem value="30d">Son 30 Gün</SelectItem>
                <SelectItem value="90d">Son 3 Ay</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileDown className="mr-2 h-4 w-4" />Dışa Aktar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={exportStockReport}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />Stok Raporu (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportExpiryReport}>
                  <CalendarClock className="mr-2 h-4 w-4" />SKT Raporu (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Value Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Toplam Stok Değeri</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(totalStockValue)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Satış fiyatı bazlı</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Maliyet Değeri</p>
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(totalPurchaseValue)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Alış fiyatı bazlı</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Potansiyel Kâr</p>
                <p className="text-2xl font-bold tracking-tight text-emerald-500">{formatCurrency(potentialProfit)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-emerald-500">
              <ArrowUpRight className="h-3 w-3" />
              <span>%{((potentialProfit / totalPurchaseValue) * 100).toFixed(1)} kâr marjı</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="overview">Genel</TabsTrigger>
          <TabsTrigger value="products">Ürünler</TabsTrigger>
          <TabsTrigger value="movements">Hareketler</TabsTrigger>
          <TabsTrigger value="expiry">SKT</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Pie: Stock Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-primary" />Stok Durumu Dağılımı
                </CardTitle>
                <CardDescription className="text-xs">Ürünlerin stok durum kategorileri</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={0}
                    initialDimension={{ width: 560, height: 280 }}
                  >
                    <PieChart>
                      <Pie
                        data={stockStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, value }) => `${name} (${value})`}
                      >
                        {stockStatusData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Bar: Category Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />Kategori Bazlı Stok
                </CardTitle>
                <CardDescription className="text-xs">Her kategorideki toplam ürün sayısı</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minWidth={0}
                    initialDimension={{ width: 560, height: 280 }}
                  >
                    <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="stock" name="Stok" radius={[0, 4, 4, 0]}>
                        {categoryData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />Ürün Bazlı Stok Değeri (Satış)
              </CardTitle>
              <CardDescription className="text-xs">En yüksek stok değerine sahip ürünler</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  initialDimension={{ width: 900, height: 350 }}
                >
                  <BarChart data={topProducts} margin={{ bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₺${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value ?? 0)), "Stok Değeri"]}
                      labelFormatter={(label) => {
                        const product = topProducts.find((p) => p.name === label);
                        return product?.fullName ?? label;
                      }}
                    />
                    <Bar dataKey="value" name="Stok Değeri" radius={[4, 4, 0, 0]}>
                      {topProducts.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Product table summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Stok Değer Özeti</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categoryData.map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <div>
                        <p className="text-sm font-medium">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">{cat.count} ürün · {cat.stock.toLocaleString("tr-TR")} birim</p>
                      </div>
                    </div>
                    <p className="font-semibold text-sm tabular-nums">{formatCurrency(cat.value)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movements" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />Stok Hareket Trendi
              </CardTitle>
              <CardDescription className="text-xs">Son 7 günlük giriş, çıkış ve transfer hareketleri</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  initialDimension={{ width: 900, height: 320 }}
                >
                  <AreaChart data={movementTrend}>
                    <defs>
                      <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="giriş" name="Giriş" stroke="hsl(142, 71%, 45%)" fill="url(#greenGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="çıkış" name="Çıkış" stroke="hsl(0, 84%, 60%)" fill="url(#redGrad)" strokeWidth={2} />
                    <Line type="monotone" dataKey="transfer" name="Transfer" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Movement summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Toplam Giriş", value: demoMovements.filter((m) => m.type === "in").reduce((s, m) => s + m.quantity, 0), color: "text-emerald-500", bg: "bg-emerald-500/10", icon: ArrowUpRight },
              { label: "Toplam Çıkış", value: demoMovements.filter((m) => m.type === "out").reduce((s, m) => s + m.quantity, 0), color: "text-rose-500", bg: "bg-rose-500/10", icon: ArrowDownRight },
              { label: "Toplam Transfer", value: demoMovements.filter((m) => m.type === "transfer").reduce((s, m) => s + m.quantity, 0), color: "text-blue-500", bg: "bg-blue-500/10", icon: TrendingUp },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className={`text-xl font-bold ${stat.color}`}>{stat.value.toLocaleString("tr-TR")}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Expiry Tab */}
        <TabsContent value="expiry" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-rose-500" />Son Kullanma Tarihi Takvimi
              </CardTitle>
              <CardDescription className="text-xs">Lot bazlı SKT takibi — yaklaşan tarihler</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {expiryData.map((lot) => (
                  <div key={lot.id} className="flex items-center gap-4 rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      lot.daysLeft <= 7 ? "bg-rose-500/10" : lot.daysLeft <= 30 ? "bg-amber-500/10" : "bg-emerald-500/10"
                    }`}>
                      <CalendarClock className={`h-5 w-5 ${
                        lot.daysLeft <= 7 ? "text-rose-500" : lot.daysLeft <= 30 ? "text-amber-500" : "text-emerald-500"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{lot.productName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="font-mono">{lot.lotNumber}</span>
                        <span>•</span>
                        <span>{lot.warehouseName}</span>
                        <span>•</span>
                        <span>{lot.quantity} adet</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={lot.daysLeft <= 7 ? "destructive" : lot.daysLeft <= 30 ? "secondary" : "outline"} className="text-xs">
                        {lot.daysLeft <= 0 ? "SÜRESİ GEÇTİ" : `${lot.daysLeft} gün`}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(lot.expiryDate!).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
