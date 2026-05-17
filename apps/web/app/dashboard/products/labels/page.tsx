"use client";

import { useEffect, useState, useMemo } from "react";
import { Printer, Plus, Minus, Loader2, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import { getProducts } from "@/lib/actions";
import type { ProductWithStock } from "@/lib/types";
import { LABEL_TEMPLATES, DEFAULT_FIELDS, type LabelFields } from "@/lib/labels/templates";
import { generateLabelsPdf, type LabelInput } from "@/lib/labels/generate-pdf";

export default function LabelsPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [templateId, setTemplateId] = useState(LABEL_TEMPLATES[0].id);
  const [fields, setFields] = useState<LabelFields>(DEFAULT_FIELDS);
  const [logoText, setLogoText] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    getProducts(undefined).then((r) => {
      if (r.ok) setProducts(r.data);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.includes(q)
    );
  }, [products, search]);

  const totalLabels = useMemo(
    () => Object.values(counts).reduce((sum, n) => sum + (n > 0 ? n : 0), 0),
    [counts]
  );

  const template = LABEL_TEMPLATES.find((t) => t.id === templateId)!;

  const inc = (id: string, delta: number) => {
    setCounts((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleGenerate = () => {
    const items: LabelInput[] = [];
    for (const [id, copies] of Object.entries(counts)) {
      if (copies <= 0) continue;
      const p = products.find((p) => p.id === id);
      if (!p) continue;
      items.push({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        salePrice: p.salePrice,
        copies,
      });
    }

    if (items.length === 0) {
      toast.error("Etiket bastırılacak ürün seçin");
      return;
    }

    setGenerating(true);
    setTimeout(() => {
      try {
        const printed = generateLabelsPdf({ template, fields, logoText, items });
        toast.success(`${printed} etiket PDF olarak indirildi`);
      } catch (e) {
        toast.error("PDF oluşturulamadı", {
          description: e instanceof Error ? e.message : "Bilinmeyen hata",
        });
      } finally {
        setGenerating(false);
      }
    }, 0);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Barkod Etiket Yazdır"
        description={`${totalLabels} etiket, ${template.label}`}
        breadcrumb={[{ label: "Ürünler", href: "/dashboard/products" }, { label: "Etiket" }]}
        actions={
          <Button onClick={handleGenerate} disabled={totalLabels === 0 || generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            PDF İndir ({totalLabels})
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Settings panel */}
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-4 space-y-4">
            <div className="grid gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Şablon</Label>
              <Select value={templateId} onValueChange={(v) => v && setTemplateId(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Görünüm</Label>
              <div className="space-y-2">
                {[
                  { key: "showLogo", label: "Logo / İsim" },
                  { key: "showName", label: "Ürün adı" },
                  { key: "showSku", label: "SKU / Barkod numarası" },
                  { key: "showPrice", label: "Satış fiyatı" },
                ].map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={fields[f.key as keyof LabelFields]}
                      onChange={(e) =>
                        setFields((prev) => ({ ...prev, [f.key]: e.target.checked }))
                      }
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            {fields.showLogo && (
              <div className="grid gap-2">
                <Label>Logo Metni</Label>
                <Input
                  value={logoText}
                  onChange={(e) => setLogoText(e.target.value)}
                  placeholder="Mağaza adı"
                  maxLength={20}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products list with counts */}
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ürün ara…"
                className="pl-9"
                enterKeyHint="search"
              />
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState title="Ürün yok" description="Arama terimini değiştirin." />
            ) : (
              <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
                {filtered.map((p) => {
                  const count = counts[p.id] ?? 0;
                  return (
                    <div key={p.id} className="flex items-center gap-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {p.sku}
                          {p.barcode && <> • {p.barcode}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => inc(p.id, -1)}
                          disabled={count === 0}
                          aria-label="Azalt"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Badge variant={count > 0 ? "default" : "secondary"} className="w-10 justify-center tabular-nums">
                          {count}
                        </Badge>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => inc(p.id, 1)}
                          aria-label="Arttır"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
