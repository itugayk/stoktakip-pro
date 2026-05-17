"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Package, Warehouse, AlertTriangle, CalendarClock,
  TrendingUp, ArrowUpRight,
  ScanLine, PackagePlus, PackageMinus, Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PageHeader } from "@/components/shared";
import { FavoritesWidget } from "@/components/dashboard/favorites-widget";
import { SmartCards } from "@/components/dashboard/smart-cards";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { getDashboardStats, getStockMovements, getExpiringLots } from "@/lib/actions";
import type { StockMovement } from "@/lib/types";
import type { ExpiringLot } from "@/lib/mappers";

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  const [stats, setStats] = useState({ totalProducts: 0, totalStock: 0, lowStock: 0, expiringCount: 0 });
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [expiringItems, setExpiringItems] = useState<ExpiringLot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, m, e] = await Promise.all([
          getDashboardStats(),
          getStockMovements({ limit: 5 }),
          getExpiringLots(),
        ]);
        if (s.ok) setStats(s.data);
        if (m.ok) setMovements(m.data);
        if (e.ok) setExpiringItems(e.data.filter((l) => l.daysLeft <= 30).slice(0, 4));
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = [
    { key: "totalProducts", value: stats.totalProducts, icon: Package, color: "text-blue-500", bg: "bg-blue-500/10" },
    { key: "totalStock", value: stats.totalStock, icon: Warehouse, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { key: "lowStock", value: stats.lowStock, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
    { key: "expiringProducts", value: stats.expiringCount, icon: CalendarClock, color: "text-rose-500", bg: "bg-rose-500/10" },
  ];

  const formatNumber = (n: number) => new Intl.NumberFormat("tr-TR").format(n);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={
          <>
            {t("welcome")},{" "}
            <span className="font-medium text-foreground">Admin</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/scanner"><ScanLine className="mr-2 h-4 w-4" />{t("scanBarcode")}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/products"><Plus className="mr-2 h-4 w-4" />{t("newProduct")}</Link>
            </Button>
          </>
        }
      />

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.key} className="stat-card hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t(stat.key as string)}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">
                    {loading ? "—" : formatNumber(stat.value)}
                  </p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SmartCards />

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: t("stockIn"), icon: PackagePlus, href: "/dashboard/inventory", color: "text-emerald-500" },
          { label: t("stockOut"), icon: PackageMinus, href: "/dashboard/inventory", color: "text-rose-500" },
          { label: t("newProduct"), icon: Plus, href: "/dashboard/products", color: "text-blue-500" },
          { label: t("scanBarcode"), icon: ScanLine, href: "/dashboard/scanner", color: "text-purple-500" },
        ].map((action) => (
          <Button key={action.href + action.label} variant="outline" className="h-auto py-4 flex flex-col gap-2 hover:bg-accent/80 transition-all" asChild>
            <Link href={action.href}>
              <action.icon className={`h-5 w-5 ${action.color}`} />
              <span className="text-xs font-medium">{action.label}</span>
            </Link>
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Recent Movements — Now from Server Actions */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t("recentMovements")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {movements.map((mov) => (
                  <div key={mov.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      mov.type === "in" ? "bg-emerald-500/10 text-emerald-500"
                        : mov.type === "out" ? "bg-rose-500/10 text-rose-500"
                          : "bg-blue-500/10 text-blue-500"
                    }`}>
                      {mov.type === "in" ? <PackagePlus className="h-4 w-4" /> : mov.type === "out" ? <PackageMinus className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mov.productName}</p>
                      <p className="text-xs text-muted-foreground">{mov.warehouseName} • {mov.userName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${
                        mov.type === "in" ? "text-emerald-500" : mov.type === "out" ? "text-rose-500" : "text-blue-500"
                      }`}>
                        {mov.type === "in" ? "+" : mov.type === "out" ? "-" : "↔"}{mov.quantity}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(mov.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
                {movements.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Henüz hareket yok</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiry Alerts — Now from Server Actions */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-rose-500" />
              SKT Uyarıları
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (<div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />))}
              </div>
            ) : (
              <div className="space-y-3">
                {expiringItems.map((item) => {
                  const days = item.daysLeft;
                  return (
                    <div key={item.id} className="rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{item.productName}</p>
                        <Badge variant={days <= 7 ? "destructive" : "secondary"} className="text-[10px]">{days} gün</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{item.lotNumber}</span>
                        <span>{item.quantity} adet</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${days <= 7 ? "bg-rose-500" : days <= 15 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.max(5, 100 - days * 3)}%` }} />
                      </div>
                    </div>
                  );
                })}
                {expiringItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">SKT uyarısı yok</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FavoritesWidget />
        <ActivityFeed limit={8} />
      </div>
    </div>
  );
}
