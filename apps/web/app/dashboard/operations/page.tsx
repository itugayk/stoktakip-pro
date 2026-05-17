"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  PackagePlus,
  PackageMinus,
  Truck,
  Undo2,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import { getOperationsSummary, type OperationsSummary } from "@/lib/actions";

interface OpsCard {
  key: keyof OperationsSummary;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const CARDS: OpsCard[] = [
  {
    key: "pendingPOs",
    label: "Onay bekleyen PO",
    description: "Satın alma siparişleri",
    href: "/dashboard/orders/purchase",
    icon: PackagePlus,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    key: "approvedPOs",
    label: "Mal kabul bekleyen PO",
    description: "Onaylı, gelen mal bekleniyor",
    href: "/dashboard/orders/purchase",
    icon: PackagePlus,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    key: "pickingSOs",
    label: "Toplama bekleyen SO",
    description: "Satış siparişleri toplama yapılacak",
    href: "/dashboard/orders/sales",
    icon: PackageMinus,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    key: "shippingSOs",
    label: "Sevkiyat bekleyen SO",
    description: "Toplama tamam, sevkedilmeyi bekliyor",
    href: "/dashboard/orders/sales",
    icon: Truck,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    key: "openCounts",
    label: "Devam eden sayım",
    description: "Açık veya inceleme aşamasında",
    href: "/dashboard/counts",
    icon: ClipboardList,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    key: "pendingReturns",
    label: "Açık iadeler",
    description: "Onay veya teslim alma bekliyor",
    href: "/dashboard/returns",
    icon: Undo2,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
];

export default function OperationsPage() {
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOperationsSummary().then((r) => {
      if (r.ok) setSummary(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  }, []);

  const total = summary
    ? CARDS.reduce((sum, c) => sum + (summary[c.key] ?? 0), 0)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Operasyon Paneli"
        description={loading ? "Yükleniyor…" : `${total} açık iş`}
      />

      {total === 0 && !loading ? (
        <Card>
          <CardContent className="p-10 flex flex-col items-center text-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-lg font-semibold">Tüm operasyon işleri tamam</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Onay bekleyen, toplama veya sevkiyat aşamasındaki bir kayıt yok.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => {
            const count = summary?.[c.key] ?? 0;
            const Icon = c.icon;
            return (
              <Card
                key={c.key}
                className={`hover:shadow-md transition-shadow ${count === 0 ? "opacity-60" : ""}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.bg}`}>
                      <Icon className={`h-6 w-6 ${c.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-3xl font-bold tabular-nums">
                        {loading ? "—" : count}
                      </p>
                      <p className="text-sm font-medium mt-0.5">{c.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                      <Button variant="ghost" size="sm" className="mt-2 -ml-2 h-7 px-2" asChild>
                        <Link href={c.href}>Aç →</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
