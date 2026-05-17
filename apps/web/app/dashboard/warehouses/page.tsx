"use client";

import { useState } from "react";
import { Warehouse as WarehouseIcon, Plus, MapPin, Package, User, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import { demoWarehouses } from "@/lib/demo-data";
import type { Warehouse } from "@/lib/types";

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState(demoWarehouses);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", manager: "" });

  const handleAdd = () => {
    if (!form.name) { toast.error("Depo adı zorunludur"); return; }
    const wh: Warehouse = {
      id: `wh-${Date.now()}`, name: form.name, address: form.address || undefined,
      managerName: form.manager || undefined, isActive: true, totalProducts: 0, totalQuantity: 0,
    };
    setWarehouses((prev) => [...prev, wh]);
    setShowAdd(false);
    setForm({ name: "", address: "", manager: "" });
    toast.success("Depo eklendi");
  };

  const openEdit = (wh: Warehouse) => {
    setEditingId(wh.id);
    setForm({ name: wh.name, address: wh.address || "", manager: wh.managerName || "" });
    setShowEdit(true);
  };

  const handleEdit = () => {
    if (!editingId || !form.name) { toast.error("Depo adı zorunludur"); return; }
    setWarehouses((prev) => prev.map((w) =>
      w.id === editingId ? { ...w, name: form.name, address: form.address || undefined, managerName: form.manager || undefined } : w
    ));
    setShowEdit(false);
    setEditingId(null);
    toast.success("Depo güncellendi");
  };

  const renderForm = () => (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label>Depo Adı *</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ana Depo" />
      </div>
      <div className="grid gap-2">
        <Label>Adres</Label>
        <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Adres bilgisi" />
      </div>
      <div className="grid gap-2">
        <Label>Sorumlu</Label>
        <Input value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} placeholder="Depo sorumlusu" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Depo Yönetimi"
        description={`${warehouses.length} depo`}
        actions={
          <Button onClick={() => { setForm({ name: "", address: "", manager: "" }); setShowAdd(true); }}>
            <Plus className="mr-2 h-4 w-4" />Yeni Depo Ekle
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {warehouses.map((wh) => (
          <Card key={wh.id} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group">
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <WarehouseIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{wh.name}</CardTitle>
                  <Badge variant={wh.isActive ? "secondary" : "destructive"} className="text-[10px] mt-1">
                    {wh.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(wh)}><Edit className="mr-2 h-4 w-4" />Düzenle</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive"
                    onClick={() => { setWarehouses((p) => p.filter((w) => w.id !== wh.id)); toast.success("Depo silindi"); }}>
                    <Trash2 className="mr-2 h-4 w-4" />Sil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="space-y-3">
              {wh.address && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{wh.address}</span>
                </div>
              )}
              {wh.managerName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4 shrink-0" />
                  <span>{wh.managerName}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{wh.totalProducts}</span>
                  <span className="text-muted-foreground">ürün</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold">{wh.totalQuantity.toLocaleString("tr-TR")}</span>
                  <span className="text-muted-foreground"> birim</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Depo Ekle</DialogTitle>
            <DialogDescription>Yeni bir depo veya şube tanımlayın</DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>İptal</Button>
            <Button onClick={handleAdd}>Depo Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Depo Düzenle</DialogTitle>
            <DialogDescription>Depo bilgilerini güncelleyin</DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>İptal</Button>
            <Button onClick={handleEdit}>Güncelle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
