"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Package,
  TrendingDown,
  X,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getReorderSuggestions,
  getDeadStock,
  getExpiringLots,
  getInventoryTurnover,
} from "@/lib/actions";
import { cn } from "@/lib/utils";

interface SmartCard {
  id: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  cta: { label: string; href: string };
}

const DISMISS_KEY = "stoktakip-dismissed-cards";

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persistDismissed(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(ids)));
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

/**
 * Computes a small set of contextual hint cards from analytics queries.
 * Each card has a stable id; the user can dismiss it (localStorage).
 * Dismissals are *not* sticky across re-dismiss conditions — when a card
 * becomes relevant again on a new dataset, the id stays the same, so the
 * dismissal still applies. That matches PHASES intent ("kullanıcı bakmasa
 * bile sistem ona söylesin"; bir kez "ilgilenmedim" der, sürekli rahatsız
 * edilmesin).
 */
export function SmartCards() {
  const [cards, setCards] = useState<SmartCard[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDismissed(loadDismissed());

    Promise.all([
      getReorderSuggestions(),
      getDeadStock({ days: 90 }),
      getExpiringLots(),
      getInventoryTurnover(),
    ]).then(([reorder, dead, expiring, turnover]) => {
      const out: SmartCard[] = [];

      if (reorder.ok && reorder.data.length > 0) {
        out.push({
          id: "reorder-low",
          icon: Package,
          iconBg: "bg-blue-500/10",
          iconColor: "text-blue-500",
          title: `${reorder.data.length} ürün önümüzdeki hafta tükeniyor`,
          description: "Stoğu minimum seviyenin altında olan ürünler için sipariş önerisi hazır.",
          cta: { label: "Sipariş önerisini gör", href: "/dashboard/reorder" },
        });
      }

      if (expiring.ok) {
        const within7 = expiring.data.filter((l) => l.daysLeft > 0 && l.daysLeft <= 7);
        if (within7.length > 0) {
          out.push({
            id: "expiry-7d",
            icon: CalendarClock,
            iconBg: "bg-orange-500/10",
            iconColor: "text-orange-500",
            title: `${within7.length} lot SKT'sine 7 gün kaldı`,
            description: "Yakın vadede son kullanma tarihi dolan ürünleri inceleyin.",
            cta: { label: "Lotları gör", href: "/dashboard/inventory/expiry" },
          });
        }
      }

      if (dead.ok && dead.data.length > 0) {
        const totalValue = dead.data.reduce((sum, r) => sum + r.stockValue, 0);
        out.push({
          id: "dead-stock",
          icon: AlertTriangle,
          iconBg: "bg-rose-500/10",
          iconColor: "text-rose-500",
          title: `Ölü stok değeri ${formatCurrency(totalValue)}`,
          description: `${dead.data.length} ürün 90+ gündür hareket görmedi.`,
          cta: { label: "İncele", href: "/dashboard/reports/dead-stock" },
        });
      }

      if (turnover.ok && turnover.data.length > 0) {
        const slow = turnover.data.filter((r) => r.turnover30d > 0 && r.turnover30d < 0.2).length;
        if (slow > 0) {
          out.push({
            id: "turnover-slow",
            icon: TrendingDown,
            iconBg: "bg-amber-500/10",
            iconColor: "text-amber-500",
            title: `${slow} ürünün devir hızı yavaş`,
            description: "Son 30 günde ortalamanın %20'si altında devir gösteren ürünler.",
            cta: { label: "Devir hızı raporu", href: "/dashboard/reports/turnover" },
          });
        }
      }

      setCards(out);
      setLoaded(true);
    });
  }, []);

  const visible = useMemo(() => cards.filter((c) => !dismissed.has(c.id)), [cards, dismissed]);

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    persistDismissed(next);
  };

  if (!loaded || visible.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {visible.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.id} className="group relative hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <button
                type="button"
                onClick={() => dismiss(card.id)}
                aria-label="Kartı gizle"
                className="absolute right-2 top-2 rounded p-1 opacity-50 hover:opacity-100 hover:bg-muted/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex gap-3">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", card.iconBg)}>
                  <Icon className={cn("h-5 w-5", card.iconColor)} />
                </div>
                <div className="min-w-0 flex-1 pr-4">
                  <p className="text-sm font-semibold leading-tight">{card.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                  <Button variant="ghost" size="sm" className="mt-2 -ml-2 h-7 px-2" asChild>
                    <Link href={card.cta.href}>
                      {card.cta.label}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
