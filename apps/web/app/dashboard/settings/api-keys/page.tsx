"use client";

import { useEffect, useState } from "react";
import { Plus, Key, Copy, Trash2, AlertTriangle, Check } from "lucide-react";
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
  listApiKeys,
  createApiKey,
  revokeApiKey,
  type ApiKey,
} from "@/lib/actions";

type Scope = "read" | "write" | "admin";

const SCOPE_LABELS: Record<Scope, string> = {
  read: "Okuma",
  write: "Yazma",
  admin: "Tam Yetki",
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: "", scopes: new Set<Scope>(["read"]) });
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    listApiKeys().then((r) => {
      if (r.ok) setKeys(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  };

  useEffect(refresh, []);

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Ad zorunlu");
      return;
    }
    const r = await createApiKey({
      name: form.name,
      scopes: Array.from(form.scopes),
    });
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    setCreatedToken(r.data.token);
    refresh();
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token).then(() => toast.success("Anahtar kopyalandı"));
  };

  const closeDialog = () => {
    setShowDialog(false);
    setCreatedToken(null);
    setForm({ name: "", scopes: new Set<Scope>(["read"]) });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader
        title="API Anahtarları"
        description="Public REST API'ye erişmek için kullanılan kimlik anahtarları"
        breadcrumb={[
          { label: "Ayarlar", href: "/dashboard/settings" },
          { label: "API Anahtarları" },
        ]}
        actions={
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Yeni Anahtar
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 flex items-start gap-2 text-sm text-muted-foreground">
          <Key className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p>
              API kullanımı için <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">Authorization: Bearer &lt;token&gt;</code> başlığını gönderin.
            </p>
            <p className="mt-1">Base URL: <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">https://&lt;domain&gt;/api/v1</code></p>
          </div>
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
      ) : keys.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Key}
              title="Henüz API anahtarı yok"
              description="İlk anahtarınızı oluşturarak public API'ye erişin."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Yetkiler</TableHead>
                  <TableHead>Son Kullanım</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id} className={k.revokedAt ? "opacity-60" : ""}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {k.scopes.map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10px]">
                            {SCOPE_LABELS[s as Scope] ?? s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("tr-TR") : "Hiç"}
                    </TableCell>
                    <TableCell>
                      {k.revokedAt ? (
                        <Badge variant="destructive" className="text-[10px]">İptal</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
                          Aktif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!k.revokedAt && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setRevokeId(k.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create / display dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) closeDialog(); else setShowDialog(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createdToken ? "Anahtarınız oluşturuldu" : "Yeni API Anahtarı"}
            </DialogTitle>
            <DialogDescription>
              {createdToken
                ? "Bu anahtarı bir daha gösteremeyiz — şimdi kopyalayın."
                : "Anahtara verilecek yetkileri seçin."}
            </DialogDescription>
          </DialogHeader>
          {createdToken ? (
            <div className="space-y-3 py-2">
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex gap-2 items-start text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                Bu pencereyi kapatınca anahtar bir daha görüntülenemez.
              </div>
              <div className="flex gap-2">
                <Input readOnly value={createdToken} className="font-mono text-xs" />
                <Button onClick={() => copyToken(createdToken)}>
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  Kopyala
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 py-2">
              <div className="grid gap-2">
                <Label>Ad *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Production Server"
                />
              </div>
              <div className="grid gap-2">
                <Label>Yetkiler</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(SCOPE_LABELS) as [Scope, string][]).map(([k, l]) => {
                    const active = form.scopes.has(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          const next = new Set(form.scopes);
                          next.has(k) ? next.delete(k) : next.add(k);
                          if (next.size === 0) next.add("read");
                          setForm({ ...form, scopes: next });
                        }}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {createdToken ? (
              <Button onClick={closeDialog}>
                <Check className="mr-1 h-3.5 w-3.5" />
                Anladım, kapat
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeDialog}>İptal</Button>
                <Button onClick={submit}>Oluştur</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(o) => !o && setRevokeId(null)}
        title="Anahtar iptal edilsin mi?"
        description="Bu anahtarla yapılan tüm istekler başarısız olacak."
        variant="destructive"
        confirmLabel="İptal Et"
        onConfirm={async () => {
          if (!revokeId) return;
          const r = await revokeApiKey(revokeId);
          if (r.ok) {
            toast.success("Anahtar iptal edildi");
            refresh();
          } else toast.error(r.error.message);
        }}
      />
    </div>
  );
}
