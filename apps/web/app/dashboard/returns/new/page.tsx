"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import {
  createReturn,
  getCustomers,
  getSuppliers,
  getWarehouses,
  getProducts,
  type ReturnType,
  type ReturnItemCondition,
} from "@/lib/actions";
import type { Customer, Supplier, Warehouse, ProductWithStock } from "@/lib/types";

interface ItemRow {
  productId: string;
  quantity: string;
  condition: ReturnItemCondition;
  lotNumber: string;
  unitValue: string;
}

const EMPTY_ITEM: ItemRow = {
  productId: "",
  quantity: "1",
  condition: "resellable",
  lotNumber: "",
  unitValue: "",
};

export default function NewReturnPage() {
  const router = useRouter();
  const [type, setType] = useState<ReturnType>("customer");
  const [warehouseId, setWarehouseId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getCustomers(), getSuppliers(), getWarehouses(), getProducts(undefined)]).then(
      ([c, s, w, p]) => {
        if (c.ok) setCustomers(c.data);
        if (s.ok) setSuppliers(s.data);
        if (w.ok) {
          setWarehouses(w.data);
          if (w.data.length > 0) setWarehouseId(w.data[0].id);
        }
        if (p.ok) setProducts(p.data);
      }
    );
  }, []);

  const updateItem = (i: number, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const submit = async () => {
    const payload = items
      .filter((it) => it.productId && Number(it.quantity) > 0)
      .map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        condition: it.condition,
        lotNumber: it.lotNumber || undefined,
        unitValue: it.unitValue ? Number(it.unitValue) : undefined,
      }));
    if (payload.length === 0) {
      toast.error("En az bir kalem girin");
      return;
    }
    setSubmitting(true);
    const result = await createReturn({
      type,
      warehouseId,
      customerId: type === "customer" ? customerId || undefined : undefined,
      supplierId: type === "supplier" ? supplierId || undefined : undefined,
      reason: reason || undefined,
      notes: notes || undefined,
      items: payload,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("İade oluşturuldu");
    router.push("/dashboard/returns");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Yeni İade"
        description="Müşteri veya tedarikçi iadesi oluşturun"
        breadcrumb={[{ label: "İadeler", href: "/dashboard/returns" }, { label: "Yeni" }]}
      />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>İade Türü *</Label>
              <Select value={type} onValueChange={(v) => v && setType(v as ReturnType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Müşteri İadesi</SelectItem>
                  <SelectItem value="supplier">Tedarikçi İadesi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Depo *</Label>
              <Select value={warehouseId} onValueChange={(v) => v && setWarehouseId(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "customer" ? (
            <div className="grid gap-2">
              <Label>Müşteri</Label>
              <Select value={customerId} onValueChange={(v) => v && setCustomerId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Müşteri seçin" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>Tedarikçi</Label>
              <Select value={supplierId} onValueChange={(v) => v && setSupplierId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tedarikçi seçin" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Sebep</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Hasarlı, yanlış ürün, vb."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <h3 className="font-semibold text-sm">Kalemler</h3>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5 grid gap-1">
                <Label className="text-xs">Ürün</Label>
                <Select
                  value={it.productId}
                  onValueChange={(v) => v && updateItem(i, { productId: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Ürün seçin" /></SelectTrigger>
                  <SelectContent>
                    {products.slice(0, 200).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 grid gap-1">
                <Label className="text-xs">Adet</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={it.quantity}
                  onChange={(e) => updateItem(i, { quantity: e.target.value })}
                  className="tabular-nums"
                />
              </div>
              <div className="col-span-2 grid gap-1">
                <Label className="text-xs">Durum</Label>
                <Select
                  value={it.condition}
                  onValueChange={(v) => v && updateItem(i, { condition: v as ReturnItemCondition })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resellable">Satılabilir</SelectItem>
                    <SelectItem value="damaged">Hasarlı</SelectItem>
                    <SelectItem value="scrap">Hurda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 grid gap-1">
                <Label className="text-xs">Lot No</Label>
                <Input
                  value={it.lotNumber}
                  onChange={(e) => updateItem(i, { lotNumber: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="col-span-1"
                onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                disabled={items.length <= 1}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Kalem ekle
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-2">
          <Label>Notlar</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>İptal</Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          İade Oluştur
        </Button>
      </div>
    </div>
  );
}
