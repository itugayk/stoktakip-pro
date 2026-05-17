"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Package,
  CheckCircle2,
  Bell,
  Settings,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
  type NotificationType,
} from "@/lib/actions";
import { cn } from "@/lib/utils";

const TYPE_META: Record<
  NotificationType,
  { label: string; icon: React.ComponentType<{ className?: string }>; bg: string; color: string }
> = {
  low_stock: { label: "Düşük Stok", icon: Package, bg: "bg-amber-500/10", color: "text-amber-500" },
  expiry_warning: { label: "SKT Yaklaşıyor", icon: CalendarClock, bg: "bg-orange-500/10", color: "text-orange-500" },
  expiry_expired: { label: "SKT Geçti", icon: AlertTriangle, bg: "bg-rose-500/10", color: "text-rose-500" },
  order_update: { label: "Sipariş", icon: ShoppingCart, bg: "bg-blue-500/10", color: "text-blue-500" },
  system: { label: "Sistem", icon: CheckCircle2, bg: "bg-muted", color: "text-foreground" },
};

const FILTER_TYPES: (NotificationType | "all")[] = [
  "all",
  "low_stock",
  "expiry_warning",
  "expiry_expired",
  "order_update",
  "system",
];

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [filterType, setFilterType] = useState<NotificationType | "all">("all");
  const [filterUnread, setFilterUnread] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    listNotifications({
      type: filterType === "all" ? undefined : filterType,
      unreadOnly: filterUnread,
      limit: 100,
    }).then((r) => {
      if (r.ok) setItems(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  };

  useEffect(refresh, [filterType, filterUnread]);

  const unread = useMemo(() => items.filter((n) => !n.isRead), [items]);

  const handleMarkRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    const r = await markNotificationRead(id);
    if (!r.ok) {
      toast.error(r.error.message);
      refresh();
    }
  };

  const handleMarkAll = async () => {
    const r = await markAllNotificationsRead();
    if (r.ok) {
      toast.success(`${r.data.updated} bildirim okundu olarak işaretlendi`);
      refresh();
    } else {
      toast.error(r.error.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="Bildirimler"
        description={unread.length > 0 ? `${unread.length} okunmamış` : "Tüm bildirimler okundu"}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/settings/rules/expiry">
                <Settings className="mr-2 h-3.5 w-3.5" />
                Kurallar
              </Link>
            </Button>
            {unread.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAll}>
                Tümünü Okundu İşaretle
              </Button>
            )}
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilterType(t)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filterType === t
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            {t === "all" ? "Tümü" : TYPE_META[t].label}
          </button>
        ))}
        <div className="flex-1" />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={filterUnread}
            onChange={(e) => setFilterUnread(e.target.checked)}
          />
          Sadece okunmamış
        </label>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Bell}
              title={filterUnread ? "Okunmamış bildirim yok" : "Henüz bildirim yok"}
              description="Stok ve SKT kuralları tetiklendiğinde burada görünür."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {items.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.system;
              const Icon = meta.icon;
              return (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkRead(n.id)}
                  className={cn(
                    "flex items-start gap-3 p-4 transition-colors",
                    !n.isRead ? "bg-primary/5 cursor-pointer hover:bg-primary/10" : ""
                  )}
                >
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0 mt-0.5", meta.bg)}>
                    <Icon className={cn("h-4 w-4", meta.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm truncate", !n.isRead ? "font-semibold" : "font-medium")}>
                        {n.title}
                      </p>
                      {!n.isRead && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      <Badge variant="outline" className="text-[10px] font-normal mr-1.5">
                        {meta.label}
                      </Badge>
                      {new Date(n.createdAt).toLocaleString("tr-TR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
