"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Mail, Phone, MapPin, MoreHorizontal, Edit, Trash2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/shared";
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/lib/actions";
import type { Customer } from "@/lib/types";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

const emptyForm = { name: "", contactPerson: "", email: "", phone: "", address: "", taxId: "", creditLimit: "" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => {
    getCustomers().then((r) => {
      if (r.ok) setCustomers(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  };

  useEffect(refresh, []);

  const payload = () => ({
    name: form.name.trim(),
    contactPerson: form.contactPerson || undefined,
    email: form.email || undefined,
    phone: form.phone || undefined,
    address: form.address || undefined,
    taxId: form.taxId || undefined,
    creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
  });

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error("Müşteri adı zorunludur"); return; }
    const r = await createCustomer(payload());
    if (r.ok) {
      toast.success("Müşteri eklendi");
      setShowAdd(false);
      setForm(emptyForm);
      refresh();
    } else { toast.error(r.error.message); }
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({
      name: c.name, contactPerson: c.contactPerson || "", email: c.email || "",
      phone: c.phone || "", address: c.address || "", taxId: c.taxId || "",
      creditLimit: c.creditLimit ? String(c.creditLimit) : "",
    });
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!editingId || !form.name.trim()) { toast.error("Müşteri adı zorunludur"); return; }
    const r = await updateCustomer({ id: editingId, patch: payload() });
    if (r.ok) {
      toast.success("Müşteri güncellendi");
      setShowEdit(false);
      setEditingId(null);
      refresh();
    } else { toast.error(r.error.message); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const r = await deleteCustomer(deleteId);
    if (r.ok) { toast.success("Müşteri silindi"); refresh(); }
    else { toast.error(r.error.message); }
  };

  const renderForm = () => (
    <div className="grid gap-3 py-2">
      <div className="grid gap-2"><Label>Müşteri Adı *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2"><Label>Yetkili</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
        <div className="grid gap-2"><Label>Vergi No</Label><Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="font-mono" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2"><Label>E-posta</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="grid gap-2"><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      </div>
      <div className="grid gap-2"><Label>Adres</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
      <div className="grid gap-2">
        <Label>Veresiye Limiti (₺)</Label>
        <Input type="number" min={0} step="0.01" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} placeholder="0 = sınırsız" className="font-mono" />
        <p className="text-[11px] text-muted-foreground">Bu tutarı aşan veresiye satış engellenir. 0 bırakırsanız limit uygulanmaz.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Müşteri Yönetimi"
        description={`${customers.length} müşteri`}
        actions={
          <Button onClick={() => { setForm(emptyForm); setShowAdd(true); }}><Plus className="mr-2 h-4 w-4" />Yeni Müşteri</Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (<div key={i} className="h-44 rounded-xl bg-muted/50 animate-pulse" />))}
        </div>
      ) : customers.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={Users} title="Henüz müşteri yok" description="İlk müşterinizi ekleyin." /></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <Card key={c.id} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group">
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px] mt-1">{c.totalOrders} işlem</Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(c)}><Edit className="mr-2 h-4 w-4" />Düzenle</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(c.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />Sil
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {c.contactPerson && <p className="font-medium text-foreground">{c.contactPerson}</p>}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                    <Mail className="h-3.5 w-3.5" />{c.email}
                  </a>
                )}
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                    <Phone className="h-3.5 w-3.5" />{c.phone}
                  </a>
                )}
                {c.address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{c.address}</div>}
                {(c.balance ?? 0) !== 0 && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Wallet className="h-3.5 w-3.5" />
                    <span className={(c.balance ?? 0) > 0 ? "text-rose-500 font-medium" : "text-emerald-500 font-medium"}>
                      {(c.balance ?? 0) > 0 ? "Borç (alacağımız): " : "Alacaklı: "}
                      {formatCurrency(Math.abs(c.balance ?? 0))}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni Müşteri</DialogTitle><DialogDescription>Müşteri bilgilerini girin</DialogDescription></DialogHeader>
          {renderForm()}
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>İptal</Button><Button onClick={handleAdd}>Ekle</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Müşteri Düzenle</DialogTitle><DialogDescription>Müşteri bilgilerini güncelleyin</DialogDescription></DialogHeader>
          {renderForm()}
          <DialogFooter><Button variant="outline" onClick={() => setShowEdit(false)}>İptal</Button><Button onClick={handleEdit}>Güncelle</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Müşteri silinsin mi?"
        description="Bu müşteriye bağlı kayıtlar etkilenebilir. Bu işlem geri alınamaz."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={handleDelete}
      />
    </div>
  );
}
