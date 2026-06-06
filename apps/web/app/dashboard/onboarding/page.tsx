"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Building2, Warehouse, Tag as TagIcon, Package, Loader2, Plus, Trash2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import { completeOnboarding } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { BUSINESS_PRESETS, BUSINESS_TYPES, type BusinessType } from "@/lib/modules/registry";

/** Sector → matching category template label (auto-applied on selection). */
const SECTOR_TEMPLATE: Partial<Record<BusinessType, string>> = {
  market: "Gıda / Market",
  pharmacy: "Eczane / Sağlık",
};

interface CategorySeed {
  name: string;
  icon: string;
  color: string;
}

interface ProductSeed {
  name: string;
  sku: string;
  unit: string;
  purchasePrice: string;
  salePrice: string;
  minStock: string;
}

const CATEGORY_TEMPLATES: { label: string; categories: CategorySeed[] }[] = [
  {
    label: "Gıda / Market",
    categories: [
      { name: "İçecek", icon: "🥤", color: "#06b6d4" },
      { name: "Atıştırmalık", icon: "🍪", color: "#f59e0b" },
      { name: "Temizlik", icon: "🧴", color: "#8b5cf6" },
      { name: "Süt Ürünleri", icon: "🥛", color: "#3b82f6" },
    ],
  },
  {
    label: "Eczane / Sağlık",
    categories: [
      { name: "İlaçlar", icon: "💊", color: "#6366f1" },
      { name: "Vitamin", icon: "🧬", color: "#22c55e" },
      { name: "Medikal", icon: "🩺", color: "#06b6d4" },
      { name: "Kozmetik", icon: "💄", color: "#ec4899" },
    ],
  },
  {
    label: "Elektronik",
    categories: [
      { name: "Telefon", icon: "📱", color: "#3b82f6" },
      { name: "Aksesuar", icon: "🔌", color: "#8b5cf6" },
      { name: "Bilgisayar", icon: "💻", color: "#6366f1" },
    ],
  },
];

const EMPTY_PRODUCT: ProductSeed = {
  name: "", sku: "", unit: "adet", purchasePrice: "", salePrice: "", minStock: "10",
};

type Step = 0 | 1 | 2 | 3 | 4;
const LAST_STEP: Step = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [submitting, setSubmitting] = useState(false);

  const [businessType, setBusinessType] = useState<BusinessType>("general");

  const [company, setCompany] = useState({
    name: "", taxId: "", phone: "", address: "", logoUrl: "",
  });

  const [warehouse, setWarehouse] = useState({ name: "Ana Depo", address: "" });

  const [categories, setCategories] = useState<CategorySeed[]>([]);

  const [products, setProducts] = useState<ProductSeed[]>([
    { ...EMPTY_PRODUCT },
  ]);

  const canNext = (() => {
    if (step === 0) return true; // sector always has a value
    if (step === 1) return company.name.trim().length > 0;
    if (step === 2) return warehouse.name.trim().length > 0;
    if (step === 3) return categories.length > 0;
    if (step === 4) return products.every((p) => !p.name || (p.name && p.sku));
    return false;
  })();

  const applyTemplate = (cats: CategorySeed[]) => {
    setCategories((prev) => {
      const existing = new Set(prev.map((c) => c.name));
      return [...prev, ...cats.filter((c) => !existing.has(c.name))];
    });
  };

  const pickBusinessType = (bt: BusinessType) => {
    setBusinessType(bt);
    const tplLabel = SECTOR_TEMPLATE[bt];
    const tpl = tplLabel ? CATEGORY_TEMPLATES.find((t) => t.label === tplLabel) : undefined;
    if (tpl) applyTemplate(tpl.categories);
  };

  const submit = async () => {
    setSubmitting(true);
    const payload = {
      company: {
        name: company.name,
        taxId: company.taxId || undefined,
        phone: company.phone || undefined,
        address: company.address || undefined,
        logoUrl: company.logoUrl || undefined,
      },
      warehouse: {
        name: warehouse.name,
        address: warehouse.address || undefined,
      },
      categories,
      products: products
        .filter((p) => p.name && p.sku)
        .map((p) => ({
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          purchasePrice: parseFloat(p.purchasePrice) || 0,
          salePrice: parseFloat(p.salePrice) || 0,
          minStock: parseInt(p.minStock) || 0,
          maxStock: 0,
        })),
      businessType,
    };

    const result = await completeOnboarding(payload);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Kurulum tamamlandı!", {
      description: `${result.data.categoryCount} kategori, ${result.data.productCount} ürün oluşturuldu.`,
    });
    router.push("/dashboard");
  };

  const steps = [
    { label: "Sektör", icon: Store },
    { label: "Şirket", icon: Building2 },
    { label: "Depo", icon: Warehouse },
    { label: "Kategori", icon: TagIcon },
    { label: "Ürünler", icon: Package },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Hoş Geldiniz"
        description="StokTakip'i kullanmaya başlamak için hızlı kurulum"
      />

      {/* Stepper */}
      <div className="flex items-center justify-between gap-2">
        {steps.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center gap-2 min-w-0">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                  ? "bg-primary/10 text-primary border-2 border-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
            </div>
            <div className="text-xs font-medium truncate hidden sm:block">{s.label}</div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 transition-colors",
                  i < step ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 0 && (
            <div className="grid gap-4">
              <h2 className="font-semibold">İşletme Tipiniz</h2>
              <p className="text-sm text-muted-foreground">
                Sektörünüze göre size uygun modüller açılır, gereksizler gizlenir.
                Sonradan Ayarlar &gt; İşletme'den değiştirebilirsiniz.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {BUSINESS_TYPES.map((bt) => {
                  const preset = BUSINESS_PRESETS[bt];
                  const active = businessType === bt;
                  return (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => pickBusinessType(bt)}
                      className={cn(
                        "text-left rounded-lg border p-3 transition-colors",
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "hover:bg-muted/50"
                      )}
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
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4">
              <h2 className="font-semibold">Şirket Bilgileri</h2>
              <div className="grid gap-2">
                <Label>Şirket Adı *</Label>
                <Input
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                  placeholder="ABC Ticaret A.Ş."
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Vergi No</Label>
                  <Input
                    value={company.taxId}
                    onChange={(e) => setCompany({ ...company, taxId: e.target.value })}
                    className="font-mono"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Telefon</Label>
                  <Input
                    value={company.phone}
                    onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                    inputMode="tel"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Adres</Label>
                <Input
                  value={company.address}
                  onChange={(e) => setCompany({ ...company, address: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Logo URL (opsiyonel)</Label>
                <Input
                  value={company.logoUrl}
                  onChange={(e) => setCompany({ ...company, logoUrl: e.target.value })}
                  placeholder="https://…"
                  inputMode="url"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <h2 className="font-semibold">İlk Depo</h2>
              <p className="text-sm text-muted-foreground">
                Stoklarınızı tutacağınız ilk depoyu oluşturun. Sonra ekleyebilirsiniz.
              </p>
              <div className="grid gap-2">
                <Label>Depo Adı *</Label>
                <Input
                  value={warehouse.name}
                  onChange={(e) => setWarehouse({ ...warehouse, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label>Adres</Label>
                <Input
                  value={warehouse.address}
                  onChange={(e) => setWarehouse({ ...warehouse, address: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4">
              <h2 className="font-semibold">Kategoriler</h2>
              <p className="text-sm text-muted-foreground">
                Hazır şablonlardan seçin veya kendinizi ekleyin. En az bir kategori gerekli.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {CATEGORY_TEMPLATES.map((t) => (
                  <Button
                    key={t.label}
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(t.categories)}
                    className="justify-start"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {t.label}
                  </Button>
                ))}
              </div>
              <Separator />
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Henüz kategori seçmediniz.
                </p>
              ) : (
                <div className="space-y-2">
                  {categories.map((c, i) => (
                    <div
                      key={`${c.name}-${i}`}
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
                    >
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded text-sm"
                        style={{ backgroundColor: `${c.color}20` }}
                      >
                        {c.icon}
                      </div>
                      <Input
                        value={c.name}
                        onChange={(e) => {
                          const next = [...categories];
                          next[i] = { ...c, name: e.target.value };
                          setCategories(next);
                        }}
                        className="h-7 flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setCategories((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCategories((prev) => [
                    ...prev,
                    { name: "Yeni Kategori", icon: "📦", color: "#6366f1" },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Manuel kategori ekle
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-4">
              <h2 className="font-semibold">İlk Ürünler</h2>
              <p className="text-sm text-muted-foreground">
                Hızlı başlamak için 1-5 ürün ekleyin. Bu adımı atlayabilirsiniz.
              </p>
              <div className="space-y-3">
                {products.map((p, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
                    <div className="grid gap-1 sm:col-span-2">
                      <Label className="text-xs">Ad</Label>
                      <Input
                        value={p.name}
                        onChange={(e) => {
                          const next = [...products];
                          next[i] = { ...p, name: e.target.value };
                          setProducts(next);
                        }}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">SKU</Label>
                      <Input
                        value={p.sku}
                        onChange={(e) => {
                          const next = [...products];
                          next[i] = { ...p, sku: e.target.value.toUpperCase() };
                          setProducts(next);
                        }}
                        className="font-mono"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Alış</Label>
                      <Input
                        value={p.purchasePrice}
                        onChange={(e) => {
                          const next = [...products];
                          next[i] = { ...p, purchasePrice: e.target.value };
                          setProducts(next);
                        }}
                        inputMode="decimal"
                        className="tabular-nums"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Satış</Label>
                      <Input
                        value={p.salePrice}
                        onChange={(e) => {
                          const next = [...products];
                          next[i] = { ...p, salePrice: e.target.value };
                          setProducts(next);
                        }}
                        inputMode="decimal"
                        className="tabular-nums"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setProducts((prev) => prev.filter((_, j) => j !== i))}
                      disabled={products.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProducts((prev) => [...prev, { ...EMPTY_PRODUCT }])}
                disabled={products.length >= 5}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Ürün ekle ({products.length}/5)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}
          disabled={step === 0 || submitting}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Geri
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push("/dashboard")} disabled={submitting}>
            Şimdi atla
          </Button>
          {step < LAST_STEP ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={!canNext || submitting}
            >
              Devam <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={!canNext || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kurulumu Tamamla
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
