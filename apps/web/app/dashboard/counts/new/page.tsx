"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import { createCount, getWarehouses, getCategories } from "@/lib/actions";
import type { Warehouse, Category } from "@/lib/types";

export default function NewCountPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getWarehouses(), getCategories()]).then(([w, c]) => {
      if (w.ok) {
        setWarehouses(w.data);
        if (w.data.length > 0) setWarehouseId(w.data[0].id);
      }
      if (c.ok) setCategories(c.data);
    });
  }, []);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!warehouseId) {
      toast.error("Önce bir depo seçin");
      return;
    }
    setSubmitting(true);
    const result = await createCount({
      warehouseId,
      name: name || undefined,
      notes: notes || undefined,
      categoryIds: selectedCategories.size > 0 ? Array.from(selectedCategories) : undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Sayım başlatıldı (${result.data.itemCount} kalem)`);
    router.push(`/dashboard/counts/${result.data.countId}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Yeni Sayım"
        description="Sayım kapsamını belirleyip başlatın"
        breadcrumb={[{ label: "Sayımlar", href: "/dashboard/counts" }, { label: "Yeni" }]}
      />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid gap-2">
            <Label>Depo *</Label>
            <Select value={warehouseId} onValueChange={(v) => v && setWarehouseId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Depo seçin" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Sayım Adı (opsiyonel)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mart 2026 Genel Sayım"
            />
          </div>

          <div className="grid gap-2">
            <Label>Kategoriler (boş = tümü)</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const active = selectedCategories.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {c.icon} {c.name}
                  </button>
                );
              })}
              {categories.length === 0 && (
                <p className="text-xs text-muted-foreground">Kategori bulunamadı.</p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Notlar</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bu sayım hakkında notlar…"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={submitting || !warehouseId} size="lg">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Sayımı Başlat
        </Button>
      </div>
    </div>
  );
}
