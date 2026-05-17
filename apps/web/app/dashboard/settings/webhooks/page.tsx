"use client";

import { useEffect, useState } from "react";
import { Plus, Webhook as WebhookIcon, Copy, Trash2, Eye, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/shared";
import {
  listWebhooks,
  upsertWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  WEBHOOK_EVENTS,
  type Webhook,
  type WebhookDelivery,
} from "@/lib/actions";

interface FormState {
  id?: string;
  name: string;
  url: string;
  events: Set<string>;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  url: "",
  events: new Set<string>(),
  isActive: true,
};

export default function WebhooksPage() {
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeliveriesFor, setShowDeliveriesFor] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  const refresh = () => {
    setLoading(true);
    listWebhooks().then((r) => {
      if (r.ok) setHooks(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  };

  useEffect(refresh, []);

  useEffect(() => {
    if (!showDeliveriesFor) {
      setDeliveries([]);
      return;
    }
    listWebhookDeliveries(showDeliveriesFor.id).then((r) => {
      if (r.ok) setDeliveries(r.data);
    });
  }, [showDeliveriesFor]);

  const submit = async () => {
    if (!form.name.trim() || !form.url.trim() || form.events.size === 0) {
      toast.error("Ad, URL ve en az bir olay seçin");
      return;
    }
    const r = await upsertWebhook({
      id: form.id,
      name: form.name,
      url: form.url,
      events: Array.from(form.events) as (typeof WEBHOOK_EVENTS)[number][],
      isActive: form.isActive,
    });
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    toast.success(form.id ? "Webhook güncellendi" : "Webhook oluşturuldu");
    setShowForm(false);
    setForm(EMPTY_FORM);
    refresh();
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret).then(() => toast.success("Secret kopyalandı"));
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader
        title="Webhooks"
        description="Olaylar gerçekleştiğinde sizin URL'inize POST atılır (HMAC imzalı)"
        breadcrumb={[
          { label: "Ayarlar", href: "/dashboard/settings" },
          { label: "Webhooks" },
        ]}
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Yeni Webhook
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p>
            Her POST'a <code className="bg-muted px-1 py-0.5 rounded font-mono">X-StokTakip-Signature: t=&lt;ms&gt;,v1=&lt;hmac&gt;</code> başlığı eklenir.
          </p>
          <p>
            Doğrulama: <code className="bg-muted px-1 py-0.5 rounded font-mono">HMAC_SHA256(secret, &quot;&lt;ms&gt;.&lt;raw_body&gt;&quot;)</code> hesaplayıp v1 ile eşleştirin.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : hooks.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={WebhookIcon}
              title="Henüz webhook yok"
              description="Stok değişiklikleri, sipariş onayları gibi olaylara abone olun."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {hooks.map((h) => (
            <Card key={h.id} className={h.isActive ? "" : "opacity-60"}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      h.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {h.isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{h.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{h.url}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowDeliveriesFor(h)}>
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    Loglar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setForm({
                        id: h.id,
                        name: h.name,
                        url: h.url,
                        events: new Set(h.events),
                        isActive: h.isActive,
                      });
                      setShowForm(true);
                    }}
                  >
                    Düzenle
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleteId(h.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pl-13">
                  {h.events.map((e) => (
                    <Badge key={e} variant="outline" className="text-[10px] font-mono">
                      {e}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 pl-13">
                  <span className="text-[10px] text-muted-foreground">Secret:</span>
                  <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                    {h.secret.slice(0, 16)}…
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copySecret(h.secret)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Webhook Düzenle" : "Yeni Webhook"}</DialogTitle>
            <DialogDescription>Hangi olaylara abone olunacak ve nereye POST atılacak?</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Ad *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>URL *</Label>
              <Input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.com/webhook"
                className="font-mono text-xs"
              />
            </div>
            <div className="grid gap-2">
              <Label>Olaylar</Label>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                {WEBHOOK_EVENTS.map((e) => {
                  const active = form.events.has(e);
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        const next = new Set(form.events);
                        next.has(e) ? next.delete(e) : next.add(e);
                        setForm({ ...form, events: next });
                      }}
                      className={`rounded-full border px-3 py-1 text-xs font-mono transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {e}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Aktif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>İptal</Button>
            <Button onClick={submit}>{form.id ? "Kaydet" : "Oluştur"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliveries dialog */}
      <Dialog open={!!showDeliveriesFor} onOpenChange={(o) => !o && setShowDeliveriesFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Teslim Geçmişi — {showDeliveriesFor?.name}</DialogTitle>
            <DialogDescription>Son 50 teslim denemesi</DialogDescription>
          </DialogHeader>
          {deliveries.length === 0 ? (
            <EmptyState title="Henüz teslim yok" description="Bu webhook tetiklendiğinde burada görünür." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Olay</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right">Süre</TableHead>
                  <TableHead>Hata</TableHead>
                  <TableHead>Zaman</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.event}</TableCell>
                    <TableCell className="text-right">
                      {d.statusCode ? (
                        <Badge
                          variant={d.success ? "secondary" : "destructive"}
                          className="text-[10px] tabular-nums"
                        >
                          {d.statusCode}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">—</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {d.durationMs ? `${d.durationMs}ms` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {d.error ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(d.createdAt).toLocaleString("tr-TR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Webhook silinsin mi?"
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={async () => {
          if (!deleteId) return;
          const r = await deleteWebhook(deleteId);
          if (r.ok) {
            toast.success("Silindi");
            refresh();
          } else toast.error(r.error.message);
        }}
      />
    </div>
  );
}
