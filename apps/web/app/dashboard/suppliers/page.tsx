"use client";

import { useState } from "react";
import { Truck, Plus, Mail, Phone, MapPin, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import { demoSuppliers } from "@/lib/demo-data";
import type { Supplier } from "@/lib/types";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState(demoSuppliers);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contactPerson: "", email: "", phone: "", address: "", taxId: "" });

  const handleAdd = () => {
    if (!form.name) { toast.error("Tedarikçi adı zorunludur"); return; }
    setSuppliers((p) => [...p, { id: `sup-${Date.now()}`, ...form, isActive: true, totalOrders: 0, createdAt: new Date().toISOString().split("T")[0] }]);
    setShowAdd(false);
    setForm({ name: "", contactPerson: "", email: "", phone: "", address: "", taxId: "" });
    toast.success("Tedarikçi eklendi");
  };

  const openEdit = (s: Supplier) => {
    setEditingId(s.id);
    setForm({
      name: s.name, contactPerson: s.contactPerson || "", email: s.email || "",
      phone: s.phone || "", address: s.address || "", taxId: s.taxId || "",
    });
    setShowEdit(true);
  };

  const handleEdit = () => {
    if (!editingId || !form.name) { toast.error("Tedarikçi adı zorunludur"); return; }
    setSuppliers((prev) => prev.map((s) =>
      s.id === editingId ? { ...s, ...form } : s
    ));
    setShowEdit(false);
    setEditingId(null);
    toast.success("Tedarikçi güncellendi");
  };

  const renderForm = () => (
    <div className="grid gap-3 py-2">
      <div className="grid gap-2"><Label>Şirket Adı *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2"><Label>Yetkili</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
        <div className="grid gap-2"><Label>Vergi No</Label><Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} className="font-mono" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2"><Label>E-posta</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="grid gap-2"><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      </div>
      <div className="grid gap-2"><Label>Adres</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tedarikçi Yönetimi"
        description={`${suppliers.length} tedarikçi`}
        actions={
          <Button onClick={() => { setForm({ name: "", contactPerson: "", email: "", phone: "", address: "", taxId: "" }); setShowAdd(true); }}><Plus className="mr-2 h-4 w-4" />Yeni Tedarikçi</Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((s) => (
          <Card key={s.id} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group">
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <Badge variant={s.isActive ? "secondary" : "destructive"} className="text-[10px] mt-1">
                    {s.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(s)}><Edit className="mr-2 h-4 w-4" />Düzenle</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => { setSuppliers((p) => p.filter((x) => x.id !== s.id)); toast.success("Silindi"); }}>
                    <Trash2 className="mr-2 h-4 w-4" />Sil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              {s.contactPerson && <p className="font-medium text-foreground">{s.contactPerson}</p>}
              {s.email && (
                <a href={`mailto:${s.email}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                  <Mail className="h-3.5 w-3.5" />{s.email}
                </a>
              )}
              {s.phone && (
                <a href={`tel:${s.phone}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                  <Phone className="h-3.5 w-3.5" />{s.phone}
                </a>
              )}
              {s.address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{s.address}</div>}
              <div className="pt-2 border-t border-border text-xs">
                <span className="font-semibold text-foreground">{s.totalOrders}</span> sipariş
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni Tedarikçi</DialogTitle><DialogDescription>Tedarikçi bilgilerini girin</DialogDescription></DialogHeader>
          {renderForm()}
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>İptal</Button><Button onClick={handleAdd}>Ekle</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tedarikçi Düzenle</DialogTitle><DialogDescription>Tedarikçi bilgilerini güncelleyin</DialogDescription></DialogHeader>
          {renderForm()}
          <DialogFooter><Button variant="outline" onClick={() => setShowEdit(false)}>İptal</Button><Button onClick={handleEdit}>Güncelle</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
