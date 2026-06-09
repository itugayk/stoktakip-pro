"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Warehouse as WarehouseIcon, Plus, MapPin, Package, User, MoreHorizontal, Edit, Trash2, QrCode, Boxes } from "lucide-react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/shared";
import {
  getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, listTeamMembers,
} from "@/lib/actions";
import { getCurrentUser } from "@/lib/actions/auth";
import type { Warehouse } from "@/lib/types";
import type { TeamMember } from "@/lib/actions";

const NONE = "none";

export default function WarehousesPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", managerId: "" });

  const refresh = () => {
    getWarehouses().then((r) => {
      if (r.ok) setWarehouses(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
    listTeamMembers().then((r) => {
      if (r.ok) setMembers(r.data);
    });
    getCurrentUser().then((u) => {
      if (u) setCanManage(u.role === "admin" || u.role === "manager");
    });
  }, []);

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error("Depo adı zorunludur"); return; }
    const r = await createWarehouse({
      name: form.name,
      address: form.address || undefined,
      managerId: form.managerId || undefined,
    });
    if (r.ok) {
      toast.success("Depo eklendi");
      setShowAdd(false);
      setForm({ name: "", address: "", managerId: "" });
      refresh();
    } else { toast.error(r.error.message); }
  };

  const openEdit = (wh: Warehouse) => {
    setEditingId(wh.id);
    setForm({ name: wh.name, address: wh.address || "", managerId: wh.managerId || "" });
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!editingId || !form.name.trim()) { toast.error("Depo adı zorunludur"); return; }
    const r = await updateWarehouse({
      id: editingId,
      patch: {
        name: form.name,
        address: form.address || null,
        managerId: form.managerId || null,
      },
    });
    if (r.ok) {
      toast.success("Depo güncellendi");
      setShowEdit(false);
      setEditingId(null);
      refresh();
    } else { toast.error(r.error.message); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const r = await deleteWarehouse(deleteId);
    if (r.ok) {
      toast.success("Depo silindi");
      refresh();
    } else { toast.error(r.error.message); }
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
        <Select
          value={form.managerId || NONE}
          onValueChange={(v) => setForm({ ...form, managerId: !v || v === NONE ? "" : v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sorumlu seçin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sorumlu yok</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Depo Yönetimi"
        description={`${warehouses.length} depo`}
        actions={
          canManage ? (
            <Button onClick={() => { setForm({ name: "", address: "", managerId: "" }); setShowAdd(true); }}>
              <Plus className="mr-2 h-4 w-4" />Yeni Depo Ekle
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (<div key={i} className="h-44 rounded-xl bg-muted/50 animate-pulse" />))}
        </div>
      ) : warehouses.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={WarehouseIcon}
              title="Henüz depo yok"
              description="Stoklarınızı yönetmek için ilk deponuzu oluşturun."
            />
          </CardContent>
        </Card>
      ) : (
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
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/inventory?warehouse=${wh.id}`)}>
                      <Boxes className="mr-2 h-4 w-4" />Ürünler / Stok
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/warehouses/${wh.id}/locations`)}>
                      <QrCode className="mr-2 h-4 w-4" />Lokasyonlar
                    </DropdownMenuItem>
                    {canManage && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEdit(wh)}><Edit className="mr-2 h-4 w-4" />Düzenle</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(wh.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />Sil
                        </DropdownMenuItem>
                      </>
                    )}
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
                <Link
                  href={`/dashboard/inventory?warehouse=${wh.id}`}
                  className="flex items-center justify-between pt-2 border-t border-border hover:text-primary transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{wh.totalProducts}</span>
                    <span className="text-muted-foreground">ürün</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">{wh.totalQuantity.toLocaleString("tr-TR")}</span>
                    <span className="text-muted-foreground"> birim</span>
                  </div>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Depo silinsin mi?"
        description="Bu depoya bağlı stok ve hareket kayıtları da silinir. Bu işlem geri alınamaz."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={handleDelete}
      />
    </div>
  );
}
