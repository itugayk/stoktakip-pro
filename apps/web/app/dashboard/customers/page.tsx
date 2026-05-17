"use client";

import { useState } from "react";
import { Users, Plus, Mail, Phone, MapPin, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import { demoCustomers } from "@/lib/demo-data";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const [customers, setCustomers] = useState(demoCustomers);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contactPerson: "", email: "", phone: "", address: "", taxId: "" });

  const handleAdd = () => {
    if (!form.name) { toast.error("Müşteri adı zorunludur"); return; }
    setCustomers((p) => [...p, { id: `cust-${Date.now()}`, ...form, isActive: true, totalOrders: 0, createdAt: new Date().toISOString().split("T")[0] }]);
    setShowAdd(false);
    setForm({ name: "", contactPerson: "", email: "", phone: "", address: "", taxId: "" });
    toast.success("Müşteri eklendi");
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({
      name: c.name, contactPerson: c.contactPerson || "", email: c.email || "",
      phone: c.phone || "", address: c.address || "", taxId: c.taxId || "",
    });
    setShowEdit(true);
  };

  const handleEdit = () => {
    if (!editingId || !form.name) { toast.error("Müşteri adı zorunludur"); return; }
    setCustomers((prev) => prev.map((c) =>
      c.id === editingId ? { ...c, ...form } : c
    ));
    setShowEdit(false);
    setEditingId(null);
    toast.success("Müşteri güncellendi");
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
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Müşteri Yönetimi"
        description={`${customers.length} müşteri`}
        actions={
          <Button onClick={() => { setForm({ name: "", contactPerson: "", email: "", phone: "", address: "", taxId: "" }); setShowAdd(true); }}><Plus className="mr-2 h-4 w-4" />Yeni Müşteri</Button>
        }
      />

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
                  <Badge variant="secondary" className="text-[10px] mt-1">{c.totalOrders} sipariş</Badge>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(c)}><Edit className="mr-2 h-4 w-4" />Düzenle</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => { setCustomers((p) => p.filter((x) => x.id !== c.id)); toast.success("Silindi"); }}>
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
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni Müşteri</DialogTitle><DialogDescription>Müşteri bilgilerini girin</DialogDescription></DialogHeader>
          {renderForm()}
          <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>İptal</Button><Button onClick={handleAdd}>Ekle</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Müşteri Düzenle</DialogTitle><DialogDescription>Müşteri bilgilerini güncelleyin</DialogDescription></DialogHeader>
          {renderForm()}
          <DialogFooter><Button variant="outline" onClick={() => setShowEdit(false)}>İptal</Button><Button onClick={handleEdit}>Güncelle</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
