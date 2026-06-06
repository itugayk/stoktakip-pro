"use client";

import { useEffect, useState } from "react";
import { CloudOff, CloudUpload, Trash2, AlertTriangle, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  listPending,
  onQueueChange,
  clearPending,
  removePending,
  type PendingAction,
} from "@/lib/offline/queue";
import { startAutoSync, syncQueue } from "@/lib/offline/sync";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const LABELS: Record<PendingAction["action"], string> = {
  stock_in: "Stok girişi",
  stock_out: "Stok çıkışı",
  transfer: "Transfer",
  count: "Sayım",
  adjustment: "Düzeltme",
};

/**
 * Header badge that shows the offline queue depth. When the user is offline,
 * the icon flips to a cloud-off variant. Click → popover with pending items
 * + manual sync / clear actions.
 */
export function OfflineIndicator() {
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const refresh = () => listPending().then(setPending);
    void refresh();
    const off = onQueueChange(refresh);
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    const stopAutoSync = startAutoSync();
    return () => {
      off();
      stopAutoSync();
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  const doSync = async () => {
    setSyncing(true);
    try {
      const r = await syncQueue();
      if (r.succeeded > 0) toast.success(`${r.succeeded} işlem gönderildi`);
      if (r.conflicts > 0)
        toast.error(`${r.conflicts} işlem çakıştı — gözden geçirin`);
      if (r.failed > 0) toast.warning(`${r.failed} işlem hâlâ bekliyor`);
    } finally {
      setSyncing(false);
    }
  };

  const conflicts = pending.filter((p) => p.conflict);
  const waiting = pending.filter((p) => !p.conflict);

  // Don't render anything when fully online with empty queue.
  if (online && pending.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-accent hover:text-accent-foreground",
          !online && "text-amber-600",
          pending.length > 0 && online && "text-blue-600",
          conflicts.length > 0 && "text-red-600"
        )}
        aria-label="Çevrimdışı durumu"
      >
        {conflicts.length > 0 ? (
          <AlertTriangle className="h-4 w-4" />
        ) : online ? (
          <CloudUpload className="h-4 w-4" />
        ) : (
          <CloudOff className="h-4 w-4" />
        )}
        {pending.length > 0 && (
          <span className="text-xs font-semibold tabular-nums">{pending.length}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">
              {online ? "Bekleyen İşlemler" : "Çevrimdışı"}
            </p>
            <p className="text-xs text-muted-foreground">
              {online
                ? `${pending.length} işlem sunucuya gönderilmeyi bekliyor.`
                : "Yaptığınız değişiklikler çevrimiçi olunca otomatik gönderilir."}
            </p>
          </div>
          {conflicts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-red-600">
                Çakışmalar ({conflicts.length})
              </p>
              <p className="text-[11px] text-muted-foreground">
                Bu işlemler sunucuda uygulanamadı (ör. stok başkası tarafından
                tükendi). İnceleyip silin, sonra gerekirse yeniden yapın.
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1.5">
                {conflicts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start justify-between gap-2 text-xs rounded-md bg-red-50 border border-red-200 px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <span className="font-medium">
                        {LABELS[p.action] ?? p.action}
                      </span>
                      {p.conflictReason && (
                        <p className="text-[11px] text-red-700 break-words">
                          {p.conflictReason}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        removePending(p.id).then(() =>
                          toast.success("Çakışma kaldırıldı")
                        )
                      }
                      aria-label="Çakışmayı kaldır"
                      className="shrink-0 text-red-600 hover:text-red-800"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {waiting.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {waiting.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-xs rounded-md bg-muted/40 px-2 py-1.5"
                >
                  <span className="font-medium">{LABELS[p.action] ?? p.action}</span>
                  <span className="text-muted-foreground">
                    {p.attempts > 0 ? `${p.attempts} deneme` : "Bekliyor"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {pending.length > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={doSync}
                disabled={!online || syncing}
                className="flex-1"
              >
                <CloudUpload className="mr-1 h-3.5 w-3.5" />
                {syncing ? "Gönderiliyor…" : "Şimdi gönder"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => clearPending().then(() => toast.success("Kuyruk temizlendi"))}
                aria-label="Kuyruğu temizle"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
