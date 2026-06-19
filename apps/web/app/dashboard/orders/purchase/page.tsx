"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PackagePlus, Plus, Search, MoreHorizontal,
  CheckCircle2, Clock, XCircle, Truck, Trash2,
} from "lucide-react";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import {
  getPurchaseOrders, createPurchaseOrder, submitForApproval, approveOrder, cancelOrder,
  getSuppliers, getProducts, getWarehouses,
} from "@/lib/actions";
import type { PurchaseOrderRow } from "@/lib/actions";
import type { Supplier, ProductWithStock, Warehouse } from "@/lib/types";

type PaymentMethodValue = "cash" | "card" | "bank_transfer" | "credit" | "check" | "other";

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Taslak", color: "bg-gray-500/10 text-gray-500 border-gray-500/30" },
  pending: { label: "Bekliyor", color: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  approved: { label: "Onaylı", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  partial: { label: "Kısmi", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30" },
  received: { label: "Teslim Alındı", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  cancelled: { label: "İptal", color: "bg-rose-500/10 text-rose-500 border-rose-500/30" },
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

interface CartLine { productId: string; name: string; quantity: number; unitPrice: number }

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);

  // create form
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("bank_transfer");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [lineProduct, setLineProduct] = useState("");
  const [lineQty, setLineQty] = useState("");
  const [linePrice, setLinePrice] = useState("");

  const refresh = () => {
    getPurchaseOrders(undefined).then((r) => {
      if (r.ok) setOrders(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
    getSuppliers().then((r) => { if (r.ok) setSuppliers(r.data); });
    getProducts(undefined).then((r) => { if (r.ok) setProducts(r.data); });
    getWarehouses().then((r) => {
      if (r.ok) { setWarehouses(r.data); if (r.data[0]) setWarehouseId(r.data[0].id); }
    });
  }, []);

  const filtered = useMemo(() => {
    let result = [...orders];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((o) => o.orderNumber.toLowerCase().includes(q) || o.supplierName.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") result = result.filter((o) => o.status === statusFilter);
    return result;
  }, [orders, search, statusFilter]);

  const addLine = () => {
    const p = products.find((x) => x.id === lineProduct);
    if (!p || !lineQty) { toast.error("Ürün ve miktar seçin"); return; }
    const qty = parseFloat(lineQty);
    if (!(qty > 0)) { toast.error("Miktar 0'dan büyük olmalı"); return; }
    const price = linePrice ? parseFloat(linePrice) : p.purchasePrice;
    setLines((prev) => [...prev, { productId: p.id, name: p.name, quantity: qty, unitPrice: price }]);
    setLineProduct(""); setLineQty(""); setLinePrice("");
  };

  const cartTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const resetForm = () => {
    setSupplierId(""); setDueDate(""); setPaymentMethod("bank_transfer"); setNotes("");
    setLines([]); setLineProduct(""); setLineQty(""); setLinePrice("");
  };

  const handleCreate = async () => {
    if (!supplierId) { toast.error("Tedarikçi seçin"); return; }
    if (!warehouseId) { toast.error("Depo seçin"); return; }
    if (lines.length === 0) { toast.error("En az bir kalem ekleyin"); return; }
    const r = await createPurchaseOrder({
      supplierId,
      warehouseId,
      notes: notes || undefined,
      paymentMethod,
      dueDate: dueDate || undefined,
      items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })),
    });
    if (r.ok) { toast.success("Satın alma siparişi oluşturuldu"); setShowAdd(false); resetForm(); refresh(); }
    else { toast.error(r.error.message); }
  };

  const doSubmit = async (id: string) => {
    const r = await submitForApproval({ orderId: id });
    if (r.ok) { toast.success("Onaya gönderildi"); refresh(); } else { toast.error(r.error.message); }
  };
  const doApprove = async (id: string) => {
    const r = await approveOrder({ orderId: id });
    if (r.ok) { toast.success("Onaylandı"); refresh(); } else { toast.error(r.error.message); }
  };
  const doCancel = async (id: string) => {
    const r = await cancelOrder({ orderId: id });
    if (r.ok) { toast.success("İptal edildi"); refresh(); } else { toast.error(r.error.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Satın Alma Siparişleri"
        description={`${filtered.length} sipariş`}
        breadcrumb={[{ label: "Siparişler" }, { label: "Satın Alma" }]}
        actions={
          <Button onClick={() => { resetForm(); setShowAdd(true); }}>
            <Plus className="mr-2 h-4 w-4" />Yeni Sipariş
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Sipariş no veya tedarikçi ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "all")}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="draft">Taslak</SelectItem>
              <SelectItem value="pending">Bekliyor</SelectItem>
              <SelectItem value="approved">Onaylı</SelectItem>
              <SelectItem value="partial">Kısmi</SelectItem>
              <SelectItem value="received">Teslim Alındı</SelectItem>
              <SelectItem value="cancelled">İptal</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sipariş No</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Ödeme</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead className="text-center w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <TableRow key={i}><TableCell colSpan={7}><div className="h-8 rounded bg-muted/50 animate-pulse" /></TableCell></TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState icon={PackagePlus} title="Sipariş bulunamadı" description="Yeni satın alma siparişi oluşturun." />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((order) => {
                  const sc = statusConfig[order.status] ?? statusConfig.draft;
                  const payLabel = order.paymentStatus === "paid" ? "Ödendi" : order.paymentStatus === "partial" ? "Kısmi" : "Ödenmedi";
                  return (
                    <TableRow key={order.id} className="group hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PackagePlus className="h-4 w-4 text-primary" />
                          <span className="font-mono font-medium text-sm">{order.orderNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{order.supplierName}</TableCell>
                      <TableCell><Badge className={`text-[10px] ${sc.color}`}>{sc.label}</Badge></TableCell>
                      <TableCell>
                        <span className={`text-xs ${order.paymentStatus === "paid" ? "text-emerald-500" : order.paymentStatus === "partial" ? "text-amber-500" : "text-rose-500"}`}>
                          {payLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-sm">{formatCurrency(order.totalAmount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(order.orderDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {order.status === "draft" && (
                              <DropdownMenuItem onClick={() => doSubmit(order.id)}>
                                <Clock className="mr-2 h-4 w-4" />Onaya Gönder
                              </DropdownMenuItem>
                            )}
                            {order.status === "pending" && (
                              <DropdownMenuItem onClick={() => doApprove(order.id)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />Onayla
                              </DropdownMenuItem>
                            )}
                            {(order.status === "approved" || order.status === "partial") && (
                              <DropdownMenuItem onClick={() => router.push(`/dashboard/orders/purchase/${order.id}/receive`)}>
                                <Truck className="mr-2 h-4 w-4" />Mal Kabul
                              </DropdownMenuItem>
                            )}
                            {(order.status === "draft" || order.status === "pending") && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => doCancel(order.id)}>
                                  <XCircle className="mr-2 h-4 w-4" />İptal Et
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Satın Alma Siparişi</DialogTitle>
            <DialogDescription>Tedarikçiye sipariş oluşturun (taslak olarak açılır)</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Tedarikçi *</Label>
                <Select value={supplierId} onValueChange={(v) => setSupplierId(v || "")}>
                  <SelectTrigger><SelectValue placeholder="Tedarikçi seçin" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.filter((s) => s.isActive).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Depo *</Label>
                <Select value={warehouseId} onValueChange={(v) => setWarehouseId(v || "")}>
                  <SelectTrigger><SelectValue placeholder="Depo seçin" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (<SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line builder */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                <div className="grid gap-1 min-w-0">
                  <Label className="text-xs">Ürün</Label>
                  <Select value={lineProduct} onValueChange={(v) => setLineProduct(v || "")}>
                    <SelectTrigger><SelectValue placeholder="Ürün" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1 w-20"><Label className="text-xs">Adet</Label><Input type="number" value={lineQty} onChange={(e) => setLineQty(e.target.value)} /></div>
                <div className="grid gap-1 w-24"><Label className="text-xs">Fiyat</Label><Input type="number" step="0.01" value={linePrice} onChange={(e) => setLinePrice(e.target.value)} placeholder="Oto" /></div>
                <Button type="button" size="icon" onClick={addLine}><Plus className="h-4 w-4" /></Button>
              </div>
              {lines.length > 0 && (
                <div className="divide-y divide-border rounded border border-border">
                  {lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 text-sm">
                      <span className="truncate">{l.name}</span>
                      <span className="flex items-center gap-2 tabular-nums">
                        {l.quantity} × {formatCurrency(l.unitPrice)}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLines((p) => p.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 font-semibold text-sm bg-muted/30">
                    <span>Ara Toplam</span><span className="tabular-nums">{formatCurrency(cartTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Ödeme Yöntemi</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod((v || "bank_transfer") as PaymentMethodValue)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Havale/EFT</SelectItem>
                    <SelectItem value="cash">Nakit</SelectItem>
                    <SelectItem value="card">Kart</SelectItem>
                    <SelectItem value="credit">Veresiye (açık hesap)</SelectItem>
                    <SelectItem value="check">Çek/Senet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Vade Tarihi</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            </div>
            <div className="grid gap-2"><Label>Not</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sipariş notu..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>İptal</Button>
            <Button onClick={handleCreate}>Sipariş Oluştur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
