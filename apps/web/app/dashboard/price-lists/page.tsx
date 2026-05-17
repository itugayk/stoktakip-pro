"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Tag, Power, PowerOff, Pencil } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/shared";
import {
  listPriceLists,
  upsertPriceList,
  deletePriceList,
  getCustomers,
  getSuppliers,
  type PriceList,
  type PriceListScope,
} from "@/lib/actions";
import { CURRENCIES } from "@/lib/fx";
import type { Customer, Supplier } from "@/lib/types";

const ALL_VALUE = "_all";

interface FormState {
  id?: string;
  name: string;
  currency: string;
  appliesTo: PriceListScope;
  appliesToId: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  currency: "TRY",
  appliesTo: "all",
  appliesToId: "",
  validFrom: "",
  validTo: "",
  isActive: true,
};

export default function PriceListsPage() {
  const [lists, setLists] = useState<PriceList[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    Promise.all([listPriceLists(), getCustomers(), getSuppliers()]).then(([l, c, s]) => {
      if (l.ok) setLists(l.data);
      if (c.ok) setCustomers(c.data);
      if (s.ok) setSuppliers(s.data);
      setLoading(false);
    });
  };

  useEffect(refresh, []);

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Liste adı zorunlu");
      return;
    }
    const r = await upsertPriceList({
      id: form.id,
      name: form.name,
      currency: form.currency,
      appliesTo: form.appliesTo,
      appliesToId: form.appliesTo === "all" ? undefined : form.appliesToId || undefined,
      validFrom: form.validFrom || undefined,
      validTo: form.validTo || undefined,
      isActive: form.isActive,
    });
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    toast.success(form.id ? "Liste güncellendi" : "Liste oluşturuldu");
    setShowDialog(false);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const r = await deletePriceList(deleteId);
    if (r.ok) {
      toast.success("Liste silindi");
      refresh();
    } else toast.error(r.error.message);
  };

  const partnerOptions =
    form.appliesTo === "customer"
      ? customers.map((c) => ({ id: c.id, name: c.name }))
      : form.appliesTo === "supplier"
      ? suppliers.map((s) => ({ id: s.id, name: s.name }))
      : [];

  const partnerName = (l: PriceList) => {
    if (l.appliesTo === "all") return "Tüm partnerler";
    if (l.appliesTo === "customer")
      return customers.find((c) => c.id === l.appliesToId)?.name ?? "Müşteri silinmiş";
    if (l.appliesTo === "supplier")
      return suppliers.find((s) => s.id === l.appliesToId)?.name ?? "Tedarikçi silinmiş";
    return `Etiket: ${l.appliesToId ?? "?"}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Fiyat Listeleri"
        description={`${lists.length} liste`}
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowDialog(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Yeni Liste
          </Button>
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
      ) : lists.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Tag}
              title="Henüz fiyat listesi yok"
              description="Müşteri veya tedarikçiye özel fiyatlar tanımlayın."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Liste</TableHead>
                  <TableHead>Kapsam</TableHead>
                  <TableHead>Para Birimi</TableHead>
                  <TableHead className="text-right">Kalem</TableHead>
                  <TableHead>Geçerlilik</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((l) => (
                  <TableRow key={l.id} className={l.isActive ? "" : "opacity-60"}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{partnerName(l)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {l.currency}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.itemCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.validFrom || "—"} → {l.validTo || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={l.isActive ? "Aktif" : "Pasif"}
                      >
                        {l.isActive ? <Power className="h-4 w-4 text-emerald-500" /> : <PowerOff className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setForm({
                            id: l.id,
                            name: l.name,
                            currency: l.currency,
                            appliesTo: l.appliesTo,
                            appliesToId: l.appliesToId ?? "",
                            validFrom: l.validFrom ?? "",
                            validTo: l.validTo ?? "",
                            isActive: l.isActive,
                          });
                          setShowDialog(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteId(l.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Listeyi Düzenle" : "Yeni Liste"}</DialogTitle>
            <DialogDescription>Kapsamı + geçerlilik aralığını belirleyin</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Ad *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Para Birimi</Label>
                <Select value={form.currency} onValueChange={(v) => v && setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Kapsam</Label>
                <Select
                  value={form.appliesTo}
                  onValueChange={(v) => v && setForm({ ...form, appliesTo: v as PriceListScope, appliesToId: "" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Herkese</SelectItem>
                    <SelectItem value="customer">Müşteri</SelectItem>
                    <SelectItem value="supplier">Tedarikçi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.appliesTo !== "all" && (
              <div className="grid gap-2">
                <Label>{form.appliesTo === "customer" ? "Müşteri" : "Tedarikçi"}</Label>
                <Select
                  value={form.appliesToId || ALL_VALUE}
                  onValueChange={(v) =>
                    setForm({ ...form, appliesToId: v === ALL_VALUE ? "" : v ?? "" })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {partnerOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Geçerli (başlangıç)</Label>
                <Input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Geçerli (bitiş)</Label>
                <Input
                  type="date"
                  value={form.validTo}
                  onChange={(e) => setForm({ ...form, validTo: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-2">
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
            <Button variant="outline" onClick={() => setShowDialog(false)}>İptal</Button>
            <Button onClick={submit}>{form.id ? "Kaydet" : "Oluştur"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Liste silinsin mi?"
        description="Bu listeye bağlı tüm fiyat kalemleri silinir."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={handleDelete}
      />
    </div>
  );
}
