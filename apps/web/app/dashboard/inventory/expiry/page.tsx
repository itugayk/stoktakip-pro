"use client";

import { useMemo } from "react";
import { CalendarClock, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { demoLots } from "@/lib/demo-data";
import { PageHeader } from "@/components/shared";

export default function ExpiryTrackingPage() {
  const lotsWithDays = useMemo(() => {
    const today = new Date();

    return demoLots
      .filter((l) => l.expiryDate)
      .map((lot) => {
        const expiry = new Date(lot.expiryDate!);
        const diffMs = expiry.getTime() - today.getTime();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return { ...lot, daysLeft };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, []);

  const expired = lotsWithDays.filter((l) => l.daysLeft <= 0);
  const expiringSoon = lotsWithDays.filter((l) => l.daysLeft > 0 && l.daysLeft <= 30);
  const safe = lotsWithDays.filter((l) => l.daysLeft > 30);

  const statusBadge = (daysLeft: number) => {
    if (daysLeft <= 0) return <Badge variant="destructive" className="text-[10px]">Süresi Geçmiş</Badge>;
    if (daysLeft <= 7) return <Badge variant="destructive" className="text-[10px]">{daysLeft} gün</Badge>;
    if (daysLeft <= 30) return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">{daysLeft} gün</Badge>;
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">{daysLeft} gün</Badge>;
  };

  const stats = [
    { label: "Süresi Geçmiş", value: expired.length, icon: ShieldAlert, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "30 Gün İçinde", value: expiringSoon.length, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Güvenli", value: safe.length, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Son Kullanma Tarihi Takibi"
        description="FEFO (First-Expired, First-Out) yönetimi"
        breadcrumb={[{ label: "Stok", href: "/dashboard/inventory" }, { label: "SKT Takibi" }]}
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="stat-card">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${s.bg}`}>
                <s.icon className={`h-6 w-6 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Tüm Lotlar — SKT Sıralaması
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ürün</TableHead>
                <TableHead>Lot No</TableHead>
                <TableHead>Depo</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
                <TableHead>SKT</TableHead>
                <TableHead className="text-center">Durum</TableHead>
                <TableHead>Aciliyet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lotsWithDays.map((lot) => (
                <TableRow key={lot.id} className={lot.daysLeft <= 0 ? "bg-destructive/5" : lot.daysLeft <= 7 ? "bg-amber-500/5" : ""}>
                  <TableCell className="font-medium text-sm">{lot.productName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{lot.lotNumber}</TableCell>
                  <TableCell className="text-sm">{lot.warehouseName}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{lot.quantity}</TableCell>
                  <TableCell className="text-sm">
                    {new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(lot.expiryDate!))}
                  </TableCell>
                  <TableCell className="text-center">{statusBadge(lot.daysLeft)}</TableCell>
                  <TableCell>
                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          lot.daysLeft <= 0 ? "bg-rose-500" : lot.daysLeft <= 7 ? "bg-rose-500" : lot.daysLeft <= 30 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.max(5, Math.min(100, 100 - lot.daysLeft))}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
