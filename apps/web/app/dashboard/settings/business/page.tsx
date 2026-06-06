"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Store, RotateCcw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import {
  getBusinessProfile, updateBusinessProfile, hardDeleteCompany, signOut,
  type BusinessProfile,
} from "@/lib/actions";
import {
  ALL_MODULES, BUSINESS_PRESETS, BUSINESS_TYPES, MODULE_LABELS,
  type BusinessType, type ModuleKey,
} from "@/lib/modules/registry";

export default function BusinessSettingsPage() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = () => getBusinessProfile().then((r) => r.ok && setProfile(r.data));
  useEffect(() => { load(); }, []);

  const applyPreset = (businessType: BusinessType) =>
    startTransition(async () => {
      const r = await updateBusinessProfile({ businessType });
      if (r.ok) {
        toast.success(`${BUSINESS_PRESETS[businessType].label} modülleri uygulandı`);
        load();
      } else toast.error(r.error.message);
    });

  const toggleModule = (key: ModuleKey) => {
    if (!profile) return;
    const set = new Set(profile.enabledModules);
    if (set.has(key)) set.delete(key); else set.add(key);
    const enabledModules = ALL_MODULES.filter((m) => set.has(m));
    startTransition(async () => {
      const r = await updateBusinessProfile({ enabledModules });
      if (r.ok) load();
      else toast.error(r.error.message);
    });
  };

  const resetToPreset = () => profile && applyPreset(profile.businessType);

  const doDelete = async () => {
    if (!confirmName.trim()) return;
    setDeleting(true);
    const r = await hardDeleteCompany({ confirmCompanyName: confirmName.trim() });
    if (r.ok) {
      toast.success("Şirket kalıcı olarak silindi");
      await signOut();
    } else {
      toast.error(r.error.message);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="İşletme Tipi & Modüller"
        description="Sektörünüze uygun paneli seçin; gereksiz modülleri gizleyin."
        breadcrumb={[{ label: "Ayarlar" }, { label: "İşletme" }]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" />İşletme Tipi
          </CardTitle>
          <CardDescription>
            Bir tip seçince o sektörün önerdiği modüller otomatik açılır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {BUSINESS_TYPES.map((bt) => {
              const preset = BUSINESS_PRESETS[bt];
              const active = profile?.businessType === bt;
              return (
                <button
                  key={bt}
                  disabled={pending}
                  onClick={() => applyPreset(bt)}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{preset.label}</span>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Modüller</CardTitle>
              <CardDescription>
                Menüde görünecek modülleri tek tek açıp kapatın.
                {profile?.hasOverride && (
                  <Badge variant="outline" className="ml-2 text-[10px]">özelleştirildi</Badge>
                )}
              </CardDescription>
            </div>
            {profile?.hasOverride && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={resetToPreset}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Varsayılana dön
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!profile ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {ALL_MODULES.map((key) => {
                const on = profile.enabledModules.includes(key);
                return (
                  <Button
                    key={key}
                    variant={on ? "default" : "outline"}
                    disabled={pending}
                    className="justify-between h-auto py-2.5"
                    onClick={() => toggleModule(key)}
                  >
                    <span className="text-xs">{MODULE_LABELS[key]}</span>
                    <span className="text-[10px] opacity-70">{on ? "Açık" : "Kapalı"}</span>
                  </Button>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            Panoya, bildirimlere, ekibe ve ayarlara her zaman erişilebilir.
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />Tehlikeli Bölge
          </CardTitle>
          <CardDescription>
            Şirketi ve tüm verilerini (ürün, stok, sipariş, ekip…) kalıcı olarak
            siler. Bu işlem <strong>geri alınamaz</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label className="text-xs">Onaylamak için şirket adınızı yazın</Label>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Şirket adı"
            />
          </div>
          <Button
            variant="destructive"
            disabled={deleting || !confirmName.trim()}
            onClick={doDelete}
          >
            {deleting ? "Siliniyor…" : "Şirketi kalıcı olarak sil"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
