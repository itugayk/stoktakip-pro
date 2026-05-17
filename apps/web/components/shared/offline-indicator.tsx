"use client";

import { useEffect, useState } from "react";
import { CloudOff, CloudUpload, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { listPending, onQueueChange, clearPending, type PendingAction } from "@/lib/offline/queue";
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
      if (r.failed > 0) toast.warning(`${r.failed} işlem hâlâ bekliyor`);
    } finally {
      setSyncing(false);
    }
  };

  // Don't render anything when fully online with empty queue.
  if (online && pending.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-accent hover:text-accent-foreground",
          !online && "text-amber-600",
          pending.length > 0 && online && "text-blue-600"
        )}
        aria-label="Çevrimdışı durumu"
      >
        {online ? (
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
          {pending.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {pending.map((p) => (
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
