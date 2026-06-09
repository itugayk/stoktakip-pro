"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ArrowRightLeft, PackagePlus, PackageMinus, Search,
  ArrowUpRight, Settings2, Download, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import { getStockMovements, getProducts, getWarehouses, createStockMovement } from "@/lib/actions";
import type { StockMovement, MovementType, ProductWithStock, Warehouse } from "@/lib/types";

const typeConfig: Record<MovementType, { label: string; color: string; icon: typeof PackagePlus }> = {
  in: { label: "Giriş", color: "text-emerald-500 bg-emerald-500/10", icon: PackagePlus },
  out: { label: "Çıkış", color: "text-rose-500 bg-rose-500/10", icon: PackageMinus },
  transfer: { label: "Transfer", color: "text-blue-500 bg-blue-500/10", icon: ArrowRightLeft },
  adjustment: { label: "Düzeltme", color: "text-amber-500 bg-amber-500/10", icon: Settings2 },
};

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [moveType, setMoveType] = useState<MovementType>("in");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      try {
        // Honor a ?warehouse=<id> deep-link (e.g. from a warehouse card) so the
        // list opens already scoped to that warehouse.
        const deepLinked = new URLSearchParams(window.location.search).get("warehouse");
        if (deepLinked) setWarehouseFilter(deepLinked);
        const [m, p, w] = await Promise.all([
          getStockMovements(undefined),
          getProducts(undefined),
          getWarehouses(),
        ]);
        if (m.ok) setMovements(m.data);
        if (p.ok) setProducts(p.data);
        if (w.ok) setWarehouses(w.data);
        if (!m.ok || !p.ok || !w.ok) toast.error("Veriler yüklenemedi");
      } catch { toast.error("Veriler yüklenemedi"); }
    }
    load();
  }, []);

  const [form, setForm] = useState({
    productId: "", warehouseId: "", toWarehouseId: "",
    quantity: "", lotNumber: "", serialNumber: "", expiryDate: "", reason: "", reference: "",
  });

  const filtered = useMemo(() => {
    let result = [...movements];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) => m.productName.toLowerCase().includes(q) || m.productSku.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== "all") result = result.filter((m) => m.type === typeFilter);
    if (warehouseFilter !== "all") {
      result = result.filter(
        (m) => m.warehouseId === warehouseFilter || m.toWarehouseId === warehouseFilter
      );
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [movements, search, typeFilter, warehouseFilter]);

  const openAdd = (type: MovementType) => {
    setMoveType(type);
    setForm({ productId: "", warehouseId: "", toWarehouseId: "", quantity: "", lotNumber: "", serialNumber: "", expiryDate: "", reason: "", reference: "" });
    setShowAddDialog(true);
  };

  const handleSubmit = async () => {
    const prod = products.find((p) => p.id === form.productId);
    const wh = warehouses.find((w) => w.id === form.warehouseId);
    if (!prod || !wh || !form.quantity) { toast.error("Zorunlu alanları doldurun"); return; }
    const toWh = warehouses.find((w) => w.id === form.toWarehouseId);

    const result = await createStockMovement({
      productId: prod.id, type: moveType, quantity: parseInt(form.quantity),
      warehouseId: wh.id, toWarehouseId: toWh?.id,
      lotNumber: form.lotNumber || undefined, serialNumber: form.serialNumber || undefined,
      expiryDate: form.expiryDate || undefined,
      reason: form.reason || undefined, reference: form.reference || undefined,
    });

    if (result.ok) {
      const qty = parseInt(form.quantity);
      const mv: StockMovement = {
        id: `mv-${Date.now()}`, productId: prod.id, productName: prod.name, productSku: prod.sku,
        type: moveType, quantity: qty, warehouseId: wh.id, warehouseName: wh.name,
        toWarehouseId: toWh?.id, toWarehouseName: toWh?.name,
        lotNumber: form.lotNumber || undefined, reason: form.reason || undefined,
        reference: form.reference || undefined, userId: "u-1", userName: "Admin",
        createdAt: new Date().toISOString(),
      };
      setMovements((prev) => [mv, ...prev]);

      setProducts((prev) => prev.map((p) => {
        if (p.id !== prod.id) return p;
        let newStock = p.currentStock;
        if (moveType === "in") newStock += qty;
        else if (moveType === "out") newStock -= qty;
        const stockStatus =
          newStock <= 0 ? "critical" as const :
          newStock <= p.minStock * 0.5 ? "critical" as const :
          newStock <= p.minStock ? "low" as const :
          p.maxStock > 0 && newStock > p.maxStock ? "overstock" as const :
          "ok" as const;
        return { ...p, currentStock: newStock, stockStatus };
      }));

      setShowAddDialog(false);
      toast.success(`Stok ${typeConfig[moveType].label.toLowerCase()} kaydedildi`);
    } else { toast.error(result.error.message); }
  };

  const exportMovementsCSV = () => {
    const headers = ["Tür", "Ürün", "SKU", "Depo", "Miktar", "Sebep", "Referans", "Kullanıcı", "Tarih"];
    const rows = filtered.map((m) => [
      typeConfig[m.type].label, m.productName, m.productSku, m.warehouseName,
      m.quantity, m.reason ?? "", m.reference ?? "", m.userName, m.createdAt,
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = `stok_hareketleri_${new Date().toISOString().split("T")[0]}.csv`;
    link.click(); URL.revokeObjectURL(url); toast.success("CSV indirildi");
  };

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Stok Hareketleri"
        description={`${filtered.length} hareket`}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Dışa Aktar</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={exportMovementsCSV}><FileSpreadsheet className="mr-2 h-4 w-4" />CSV İndir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => openAdd("in")} className="bg-emerald-600 hover:bg-emerald-700">
              <PackagePlus className="mr-2 h-4 w-4" />Giriş
            </Button>
            <Button onClick={() => openAdd("out")} variant="destructive">
              <PackageMinus className="mr-2 h-4 w-4" />Çıkış
            </Button>
            <Button onClick={() => openAdd("transfer")} variant="outline">
              <ArrowRightLeft className="mr-2 h-4 w-4" />Transfer
            </Button>
          </>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Ürün adı veya SKU ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Tür" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="in">Giriş</SelectItem>
              <SelectItem value="out">Çıkış</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="adjustment">Düzeltme</SelectItem>
            </SelectContent>
          </Select>
          <Select value={warehouseFilter} onValueChange={(v) => setWarehouseFilter(v ?? "all")}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Depo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm depolar</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tür</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead>Depo</TableHead>
                <TableHead className="text-right">Miktar</TableHead>
                <TableHead>Sebep / Ref.</TableHead>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((mv) => {
                const cfg = typeConfig[mv.type];
                const Icon = cfg.icon;
                return (
                  <TableRow key={mv.id}>
                    <TableCell>
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cfg.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{mv.productName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{mv.productSku}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{mv.warehouseName}</p>
                      {mv.toWarehouseName && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <ArrowUpRight className="h-3 w-3" />{mv.toWarehouseName}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold tabular-nums ${mv.type === "in" ? "text-emerald-500" : mv.type === "out" ? "text-rose-500" : ""}`}>
                        {mv.type === "in" ? "+" : mv.type === "out" ? "-" : ""}{mv.quantity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs">{mv.reason || "-"}</p>
                      {mv.reference && <p className="text-[10px] text-muted-foreground font-mono">{mv.reference}</p>}
                    </TableCell>
                    <TableCell className="text-xs">{mv.userName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(mv.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Movement Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stok {typeConfig[moveType].label}</DialogTitle>
            <DialogDescription>Yeni stok hareketi kaydedin</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Ürün *</Label>
              <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Ürün seçin" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>{moveType === "transfer" ? "Kaynak Depo" : "Depo"} *</Label>
                <Select value={form.warehouseId} onValueChange={(v) => setForm({ ...form, warehouseId: v ?? "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {moveType === "transfer" ? (
                <div className="grid gap-2">
                  <Label>Hedef Depo *</Label>
                  <Select value={form.toWarehouseId} onValueChange={(v) => setForm({ ...form, toWarehouseId: v ?? "" })}>
                    <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.filter((w) => w.id !== form.warehouseId).map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Miktar *</Label>
                  <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
                </div>
              )}
            </div>
            {moveType === "transfer" && (
              <div className="grid gap-2">
                <Label>Miktar *</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Lot / Parti No</Label>
                <Input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} placeholder="LOT-2026-A01" className="font-mono" />
              </div>
              <div className="grid gap-2">
                <Label>SKT</Label>
                <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Seri No (varsa)</Label>
              <Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="SN-000123" className="font-mono" />
            </div>
            <div className="grid gap-2">
              <Label>Sebep</Label>
              <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Tedarikçi siparişi, müşteri satışı..." />
            </div>
            <div className="grid gap-2">
              <Label>Referans No</Label>
              <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="PO-2026-001" className="font-mono" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>İptal</Button>
            <Button onClick={handleSubmit}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
