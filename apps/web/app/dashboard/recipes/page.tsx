"use client";

import { useEffect, useState, useTransition } from "react";
import { ChefHat, Plus, Trash2, Factory, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import {
  listRecipes, getRecipe, upsertRecipe, deleteRecipe, produceRecipe,
  getProducts, getWarehouses, type RecipeRow,
} from "@/lib/actions";

interface Option { id: string; name: string }
interface ItemForm { componentProductId: string; quantity: string }
const emptyItem = (): ItemForm => ({ componentProductId: "", quantity: "" });

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const [editor, setEditor] = useState<null | { id?: string }>(null);
  const [form, setForm] = useState({ productId: "", name: "", yieldQty: "1", items: [emptyItem()] });

  const [producing, setProducing] = useState<RecipeRow | null>(null);
  const [produceForm, setProduceForm] = useState({ quantity: "", warehouseId: "" });

  const refresh = () => listRecipes().then((r) => { if (r.ok) setRecipes(r.data); setLoading(false); });

  useEffect(() => {
    refresh();
    getProducts(undefined).then((r) => r.ok && setProducts(r.data.map((p) => ({ id: p.id, name: p.name }))));
    getWarehouses().then((r) => r.ok && setWarehouses(r.data.map((w) => ({ id: w.id, name: w.name }))));
  }, []);

  const openNew = () => {
    setForm({ productId: "", name: "", yieldQty: "1", items: [emptyItem()] });
    setEditor({});
  };

  const openEdit = (id: string) =>
    startTransition(async () => {
      const r = await getRecipe(id);
      if (r.ok && r.data) {
        setForm({
          productId: r.data.productId,
          name: r.data.name,
          yieldQty: String(r.data.yieldQty),
          items: r.data.items.map((it) => ({ componentProductId: it.componentProductId, quantity: String(it.quantity) })),
        });
        setEditor({ id });
      }
    });

  const setItem = (i: number, patch: Partial<ItemForm>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (i: number) => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const save = () => {
    const items = form.items
      .filter((it) => it.componentProductId && parseFloat(it.quantity) > 0)
      .map((it) => ({ componentProductId: it.componentProductId, quantity: parseFloat(it.quantity) }));
    if (!form.productId || !form.name.trim() || items.length === 0) {
      toast.error("Ürün, ad ve en az bir bileşen gerekli");
      return;
    }
    startTransition(async () => {
      const r = await upsertRecipe({
        id: editor?.id,
        productId: form.productId,
        name: form.name.trim(),
        yieldQty: parseFloat(form.yieldQty) || 1,
        items,
      });
      if (r.ok) { toast.success("Reçete kaydedildi"); setEditor(null); refresh(); }
      else toast.error(r.error.message);
    });
  };

  const remove = (id: string) =>
    startTransition(async () => {
      const r = await deleteRecipe(id);
      if (r.ok) { toast.success("Reçete silindi"); refresh(); }
      else toast.error(r.error.message);
    });

  const openProduce = (rec: RecipeRow) => {
    setProduceForm({ quantity: String(rec.yieldQty), warehouseId: warehouses[0]?.id ?? "" });
    setProducing(rec);
  };

  const doProduce = () => {
    if (!producing) return;
    const quantity = parseFloat(produceForm.quantity);
    if (!quantity || quantity <= 0 || !produceForm.warehouseId) {
      toast.error("Miktar ve depo gerekli");
      return;
    }
    startTransition(async () => {
      const r = await produceRecipe({ recipeId: producing.id, quantity, warehouseId: produceForm.warehouseId });
      if (r.ok) {
        toast.success(`${r.data.produced} ${producing.productName} üretildi`);
        setProducing(null);
      } else {
        toast.error(r.error.message);
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reçeteler"
        description={`${recipes.length} reçete`}
        breadcrumb={[{ label: "Stok İşlemleri" }, { label: "Reçeteler" }]}
        actions={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Yeni Reçete</Button>}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reçete</TableHead>
                <TableHead>Üretilen Ürün</TableHead>
                <TableHead className="text-right">Verim</TableHead>
                <TableHead className="text-right">Bileşen</TableHead>
                <TableHead className="text-right w-[200px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipes.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-4 w-4 text-amber-500" />
                      {rec.name}
                      {!rec.isActive && <Badge variant="outline" className="text-[10px]">pasif</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{rec.productName}</TableCell>
                  <TableCell className="text-right tabular-nums">{rec.yieldQty}</TableCell>
                  <TableCell className="text-right tabular-nums">{rec.itemCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="default" disabled={pending} onClick={() => openProduce(rec)}>
                        <Factory className="mr-1 h-3.5 w-3.5" />Üret
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={pending} onClick={() => openEdit(rec.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" disabled={pending} onClick={() => remove(rec.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && recipes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <ChefHat className="mx-auto h-10 w-10 mb-3 opacity-30" />
                    <p>Henüz reçete yok</p>
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Yükleniyor…</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Editor dialog */}
      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editor?.id ? "Reçeteyi Düzenle" : "Yeni Reçete"}</DialogTitle>
            <DialogDescription>Üretilen ürünü ve harcanan bileşenleri tanımlayın.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label>Reçete Adı *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ör. Cheeseburger" />
            </div>
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div className="grid gap-2">
                <Label>Üretilen Ürün *</Label>
                <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v || "" })}>
                  <SelectTrigger><SelectValue placeholder="Ürün" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Verim</Label>
                <Input type="number" step="0.01" value={form.yieldQty} onChange={(e) => setForm({ ...form, yieldQty: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Bileşenler *</Label>
                <Button type="button" size="sm" variant="ghost" onClick={addItem}><Plus className="mr-1 h-3.5 w-3.5" />Ekle</Button>
              </div>
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_auto] gap-2 items-end">
                  <Select value={it.componentProductId} onValueChange={(v) => setItem(i, { componentProductId: v || "" })}>
                    <SelectTrigger><SelectValue placeholder="Malzeme" /></SelectTrigger>
                    <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" step="0.01" placeholder="Miktar" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                  <Button type="button" size="icon" variant="ghost" className="h-9 w-9" disabled={form.items.length === 1} onClick={() => removeItem(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>İptal</Button>
            <Button onClick={save} disabled={pending}>{pending ? "Kaydediliyor…" : "Kaydet"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Produce dialog */}
      <Dialog open={!!producing} onOpenChange={(o) => !o && setProducing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Üretim — {producing?.name}</DialogTitle>
            <DialogDescription>
              Bileşenler stoktan FEFO ile düşülür, üretilen ürün stoğa eklenir.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Üretilecek Miktar *</Label>
              <Input type="number" step="0.01" value={produceForm.quantity} onChange={(e) => setProduceForm({ ...produceForm, quantity: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Depo *</Label>
              <Select value={produceForm.warehouseId} onValueChange={(v) => setProduceForm({ ...produceForm, warehouseId: v || "" })}>
                <SelectTrigger><SelectValue placeholder="Depo seçin" /></SelectTrigger>
                <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProducing(null)}>İptal</Button>
            <Button onClick={doProduce} disabled={pending}>{pending ? "Üretiliyor…" : "Üret"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
