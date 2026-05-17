"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Play, Loader2, Bell, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  listExpiryRules,
  upsertExpiryRule,
  deleteExpiryRule,
  runExpiryRulesNow,
  getCategories,
  type ExpiryRule,
  type Channel,
} from "@/lib/actions";
import type { Category } from "@/lib/types";

const CHANNEL_LABELS: Record<Channel, string> = {
  in_app: "Uygulama içi",
  email: "E-posta",
  push: "Push",
  whatsapp: "WhatsApp",
};

const ALL_CATEGORY_VALUE = "_all";

interface FormState {
  id?: string;
  name: string;
  triggerDays: string;
  categoryId: string;
  channels: Set<Channel>;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  id: undefined,
  name: "",
  triggerDays: "30",
  categoryId: "",
  channels: new Set(["in_app"]),
  isActive: true,
};

export default function ExpiryRulesPage() {
  const [rules, setRules] = useState<ExpiryRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    Promise.all([listExpiryRules(), getCategories()]).then(([r, c]) => {
      if (r.ok) setRules(r.data);
      if (c.ok) setCategories(c.data);
      setLoading(false);
    });
  };

  useEffect(refresh, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (rule: ExpiryRule) => {
    setForm({
      id: rule.id,
      name: rule.name,
      triggerDays: String(rule.triggerDays),
      categoryId: rule.categoryId ?? "",
      channels: new Set(rule.channels),
      isActive: rule.isActive,
    });
    setShowDialog(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Kural adı zorunlu");
      return;
    }
    const days = parseInt(form.triggerDays);
    if (!Number.isFinite(days) || days <= 0) {
      toast.error("Gün sayısı pozitif olmalı");
      return;
    }
    const result = await upsertExpiryRule({
      id: form.id,
      name: form.name,
      triggerDays: days,
      categoryId: form.categoryId || undefined,
      channels: Array.from(form.channels),
      isActive: form.isActive,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(form.id ? "Kural güncellendi" : "Kural eklendi");
    setShowDialog(false);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const r = await deleteExpiryRule(deleteId);
    if (r.ok) {
      toast.success("Kural silindi");
      refresh();
    } else {
      toast.error(r.error.message);
    }
  };

  const runNow = async () => {
    setRunning(true);
    const r = await runExpiryRulesNow();
    setRunning(false);
    if (r.ok) {
      toast.success(`Kural motoru çalıştı`, {
        description: `${r.data.fired} yeni bildirim oluşturuldu.`,
      });
    } else {
      toast.error(r.error.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="SKT Kuralları"
        description="Son kullanma tarihi yaklaşan lotlar için bildirim kuralları"
        breadcrumb={[
          { label: "Ayarlar", href: "/dashboard/settings" },
          { label: "Kurallar" },
          { label: "SKT" },
        ]}
        actions={
          <>
            <Button variant="outline" onClick={runNow} disabled={running || rules.length === 0}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Şimdi Çalıştır
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Yeni Kural
            </Button>
          </>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Bell}
              title="Henüz kural yok"
              description="SKT yaklaşan lotlar için bildirim kuralları oluşturun (ör. 30, 14, 7 gün)."
              cta={
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  İlk Kuralı Oluştur
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const category = categories.find((c) => c.id === rule.categoryId);
            return (
              <Card
                key={rule.id}
                className={`hover:shadow-md transition-shadow ${rule.isActive ? "" : "opacity-60"}`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      rule.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {rule.isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{rule.name}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {rule.triggerDays} gün kala
                      </Badge>
                      {category && (
                        <Badge variant="outline" className="text-[10px]">
                          {category.icon} {category.name}
                        </Badge>
                      )}
                      {!category && rule.categoryId === undefined && (
                        <Badge variant="outline" className="text-[10px]">Tüm kategoriler</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Kanal: {rule.channels.map((c) => CHANNEL_LABELS[c]).join(", ")}
                      {rule.lastRunAt && ` • Son çalıştırma: ${new Date(rule.lastRunAt).toLocaleString("tr-TR")}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                    Düzenle
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleteId(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Kuralı Düzenle" : "Yeni Kural"}</DialogTitle>
            <DialogDescription>
              Belirlenen gün öncesinde, kapsamdaki lotlar için bildirim oluşturulur.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Kural Adı *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="30 gün kala uyarı"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Gün</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.triggerDays}
                  onChange={(e) => setForm({ ...form, triggerDays: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Kategori</Label>
                <Select
                  value={form.categoryId || ALL_CATEGORY_VALUE}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      categoryId: !v || v === ALL_CATEGORY_VALUE ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CATEGORY_VALUE}>Tüm kategoriler</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Kanallar</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(CHANNEL_LABELS) as [Channel, string][]).map(([key, label]) => {
                  const active = form.channels.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        const next = new Set(form.channels);
                        next.has(key) ? next.delete(key) : next.add(key);
                        if (next.size === 0) next.add("in_app");
                        setForm({ ...form, channels: next });
                      }}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Kural aktif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>İptal</Button>
            <Button onClick={submit}>{form.id ? "Kaydet" : "Oluştur"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Kural silinsin mi?"
        description="Bu kuraldan oluşmuş mevcut bildirimler korunur."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={handleDelete}
      />
    </div>
  );
}
