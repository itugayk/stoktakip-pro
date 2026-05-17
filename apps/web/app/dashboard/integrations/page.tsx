"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plug, Settings, Trash2, Power, PowerOff, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
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
import { toast } from "sonner";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/shared";
import { INTEGRATIONS, findProvider } from "@/lib/integrations/registry";
import {
  listConnections,
  upsertConnection,
  deleteConnection,
  testConnection,
  type Connection,
} from "@/lib/actions";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  marketplace: "Pazaryeri",
  accounting: "Muhasebe",
  shipping: "Kargo",
  e_invoice: "e-Fatura",
  messaging: "Mesajlaşma",
};

const STATUS_META = {
  active: { label: "Aktif", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  connecting: { label: "Bağlanıyor", color: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  inactive: { label: "Pasif", color: "bg-muted text-muted-foreground" },
  error: { label: "Hata", color: "bg-rose-500/15 text-rose-600 border-rose-500/30" },
} as const;

export default function IntegrationsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupProvider, setSetupProvider] = useState<string | null>(null);
  const [editConnection, setEditConnection] = useState<Connection | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; config: Record<string, string> }>({
    name: "",
    config: {},
  });

  const refresh = () => {
    setLoading(true);
    listConnections().then((r) => {
      if (r.ok) setConnections(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  };

  useEffect(refresh, []);

  const connectionsByCategory = useMemo(() => {
    const map = new Map<string, Connection[]>();
    for (const c of connections) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return map;
  }, [connections]);

  const providersByCategory = useMemo(() => {
    const map = new Map<string, typeof INTEGRATIONS>();
    for (const p of INTEGRATIONS) {
      const list = map.get(p.meta.category) ?? [];
      list.push(p);
      map.set(p.meta.category, list);
    }
    return map;
  }, []);

  const openSetup = (providerId: string) => {
    const p = findProvider(providerId);
    if (!p) return;
    setSetupProvider(providerId);
    setForm({ name: p.meta.label, config: {} });
  };

  const openEdit = (conn: Connection) => {
    setEditConnection(conn);
    setForm({ name: conn.name, config: {} });
  };

  const submit = async () => {
    const providerId = setupProvider ?? editConnection?.provider;
    if (!providerId) return;
    const r = await upsertConnection({
      id: editConnection?.id,
      provider: providerId,
      name: form.name,
      config: form.config,
    });
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    toast.success("Bağlantı kaydedildi");
    setSetupProvider(null);
    setEditConnection(null);
    refresh();
  };

  const handleTest = async (id: string) => {
    const r = await testConnection(id);
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    if (r.data.ok) {
      toast.success(r.data.message);
    } else {
      toast.warning(r.data.message);
    }
  };

  const dialogProvider = setupProvider
    ? findProvider(setupProvider)
    : editConnection
    ? findProvider(editConnection.provider)
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Entegrasyonlar"
        description="Mağaza, muhasebe, kargo ve mesajlaşma sağlayıcıları"
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/settings/api-keys">
              <Plug className="mr-2 h-4 w-4" />
              API Anahtarları
            </Link>
          </Button>
        }
      />

      {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
        const myConns = connectionsByCategory.get(cat) ?? [];
        const providers = providersByCategory.get(cat) ?? [];
        return (
          <section key={cat} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </h2>

            {/* Active connections */}
            {myConns.length > 0 && (
              <div className="grid gap-2">
                {myConns.map((c) => {
                  const provider = findProvider(c.provider);
                  const isStub = provider?.stub;
                  return (
                    <Card key={c.id} className="group">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Plug className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{c.name}</p>
                            <Badge
                              className={cn("text-[10px]", STATUS_META[c.status].color)}
                              variant="outline"
                            >
                              {STATUS_META[c.status].label}
                            </Badge>
                            {isStub && (
                              <Badge variant="secondary" className="text-[10px]">
                                <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
                                Stub
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {provider?.meta.label}
                            {c.lastSyncAt && ` · Son senkron: ${new Date(c.lastSyncAt).toLocaleString("tr-TR")}`}
                          </p>
                          {c.lastError && (
                            <p className="text-xs text-rose-500 mt-1 truncate">{c.lastError}</p>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleTest(c.id)}>
                          Test
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteId(c.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Available providers (the ones we haven't connected) */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((p) => (
                <Card key={p.meta.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">{p.meta.label}</p>
                      {p.stub && (
                        <Badge variant="secondary" className="text-[10px]">
                          Stub
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {p.meta.description}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => openSetup(p.meta.id)}>
                        <Plug className="mr-1 h-3.5 w-3.5" />
                        Bağla
                      </Button>
                      {p.meta.docsUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          asChild
                          title="API dokümanı"
                        >
                          <a href={p.meta.docsUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      {loading && (
        <div className="text-center text-sm text-muted-foreground py-4">Yükleniyor…</div>
      )}

      {/* Setup / edit dialog */}
      <Dialog
        open={!!setupProvider || !!editConnection}
        onOpenChange={(o) => {
          if (!o) {
            setSetupProvider(null);
            setEditConnection(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editConnection ? "Bağlantıyı Düzenle" : `${dialogProvider?.meta.label} Bağla`}
            </DialogTitle>
            <DialogDescription>
              {dialogProvider?.meta.description}
              {dialogProvider?.stub && (
                <span className="block mt-1 text-amber-600 text-xs">
                  Bu sağlayıcı henüz stub — API kontratı bağlanmadığı için gerçek çağrı yapılmaz.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {dialogProvider && (
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <Label>Bağlantı Adı</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              {dialogProvider.meta.configSchema.map((f) => (
                <div key={f.key} className="grid gap-2">
                  <Label>
                    {f.label}
                    {f.required && " *"}
                  </Label>
                  <Input
                    type={f.type === "password" ? "password" : "text"}
                    value={form.config[f.key] ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        config: { ...form.config, [f.key]: e.target.value },
                      })
                    }
                    placeholder={f.placeholder}
                  />
                  {f.helpText && (
                    <p className="text-[10px] text-muted-foreground">{f.helpText}</p>
                  )}
                </div>
              ))}
              {dialogProvider.meta.docsUrl && (
                <a
                  href={dialogProvider.meta.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  API dokümanına git
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSetupProvider(null);
                setEditConnection(null);
              }}
            >
              İptal
            </Button>
            <Button onClick={submit}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Bağlantı silinsin mi?"
        description="Bu sağlayıcıya yapılan senkronlar duracak."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={async () => {
          if (!deleteId) return;
          const r = await deleteConnection(deleteId);
          if (r.ok) {
            toast.success("Silindi");
            refresh();
          } else toast.error(r.error.message);
        }}
      />
    </div>
  );
}
