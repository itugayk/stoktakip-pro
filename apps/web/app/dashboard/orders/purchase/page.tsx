"use client";

import { useState, useMemo } from "react";
import {
  PackagePlus, Plus, Search, Eye, MoreHorizontal,
  CheckCircle2, Clock, XCircle, Truck,
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { demoSuppliers, demoProducts } from "@/lib/demo-data";
import { PageHeader } from "@/components/shared";

type OrderStatus = "draft" | "pending" | "approved" | "received" | "cancelled";

interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface PurchaseOrder {
  id: string;
  orderNo: string;
  supplierId: string;
  supplierName: string;
  status: OrderStatus;
  items: PurchaseOrderItem[];
  totalAmount: number;
  notes?: string;
  createdAt: string;
  expectedDate?: string;
}

const statusConfig: Record<OrderStatus, { label: string; icon: typeof Clock; color: string }> = {
  draft: { label: "Taslak", icon: Clock, color: "bg-gray-500/10 text-gray-500 border-gray-500/30" },
  pending: { label: "Bekliyor", icon: Clock, color: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  approved: { label: "Onaylı", icon: CheckCircle2, color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  received: { label: "Teslim Alındı", icon: Truck, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  cancelled: { label: "İptal", icon: XCircle, color: "bg-rose-500/10 text-rose-500 border-rose-500/30" },
};

const demoPurchaseOrders: PurchaseOrder[] = [
  {
    id: "po-1", orderNo: "PO-2026-001", supplierId: "sup-1", supplierName: "MedPharma A.Ş.",
    status: "received", totalAmount: 6250,
    items: [
      { productId: "prod-1", productName: "Paracetamol 500mg", quantity: 500, unitPrice: 12.50 },
    ],
    createdAt: "2026-05-10", expectedDate: "2026-05-14",
  },
  {
    id: "po-2", orderNo: "PO-2026-002", supplierId: "sup-1", supplierName: "MedPharma A.Ş.",
    status: "approved", totalAmount: 7000,
    items: [
      { productId: "prod-3", productName: "Antibiyotik Kapsül 250mg", quantity: 200, unitPrice: 35.00 },
    ],
    createdAt: "2026-05-12", expectedDate: "2026-05-18",
  },
  {
    id: "po-3", orderNo: "PO-2026-003", supplierId: "sup-3", supplierName: "CleanTech Kimya",
    status: "pending", totalAmount: 4500,
    items: [
      { productId: "prod-10", productName: "El Dezenfektanı 500ml", quantity: 300, unitPrice: 15.00 },
    ],
    createdAt: "2026-05-13", expectedDate: "2026-05-20",
  },
  {
    id: "po-4", orderNo: "PO-2026-004", supplierId: "sup-2", supplierName: "VitaPlus Ltd.",
    status: "draft", totalAmount: 8500,
    items: [
      { productId: "prod-5", productName: "Omega 3 Balık Yağı", quantity: 100, unitPrice: 85.00 },
    ],
    createdAt: "2026-05-14",
  },
];

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState(demoPurchaseOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState({
    supplierId: "", productId: "", quantity: "", unitPrice: "", notes: "", expectedDate: "",
  });

  const filtered = useMemo(() => {
    let result = [...orders];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((o) => o.orderNo.toLowerCase().includes(q) || o.supplierName.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") result = result.filter((o) => o.status === statusFilter);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, search, statusFilter]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

  const handleAdd = () => {
    const supplier = demoSuppliers.find((s) => s.id === form.supplierId);
    const product = demoProducts.find((p) => p.id === form.productId);
    if (!supplier || !product || !form.quantity) { toast.error("Zorunlu alanları doldurun"); return; }
    const qty = parseInt(form.quantity);
    const price = parseFloat(form.unitPrice) || product.purchasePrice;
    const po: PurchaseOrder = {
      id: `po-${Date.now()}`, orderNo: `PO-2026-${String(orders.length + 1).padStart(3, "0")}`,
      supplierId: supplier.id, supplierName: supplier.name, status: "draft",
      items: [{ productId: product.id, productName: product.name, quantity: qty, unitPrice: price }],
      totalAmount: qty * price, notes: form.notes || undefined, expectedDate: form.expectedDate || undefined,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setOrders((prev) => [po, ...prev]);
    setShowAdd(false);
    setForm({ supplierId: "", productId: "", quantity: "", unitPrice: "", notes: "", expectedDate: "" });
    toast.success("Satın alma siparişi oluşturuldu");
  };

  const updateStatus = (id: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    toast.success(`Sipariş durumu güncellendi: ${statusConfig[status].label}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Satın Alma Siparişleri"
        description={`${filtered.length} sipariş`}
        breadcrumb={[{ label: "Siparişler" }, { label: "Satın Alma" }]}
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />Yeni Sipariş
          </Button>
        }
      />

      {/* Filters */}
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
              <SelectItem value="received">Teslim Alındı</SelectItem>
              <SelectItem value="cancelled">İptal</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sipariş No</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead className="text-center w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => {
                const sc = statusConfig[order.status];
                return (
                  <TableRow key={order.id} className="group hover:bg-muted/50 cursor-pointer" onClick={() => setShowDetail(order)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PackagePlus className="h-4 w-4 text-primary" />
                        <span className="font-mono font-medium text-sm">{order.orderNo}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{order.supplierName}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">{formatCurrency(order.totalAmount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowDetail(order); }}>
                            <Eye className="mr-2 h-4 w-4" />Detay
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {order.status === "draft" && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "pending"); }}>
                              <Clock className="mr-2 h-4 w-4" />Onaya Gönder
                            </DropdownMenuItem>
                          )}
                          {order.status === "pending" && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "approved"); }}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />Onayla
                            </DropdownMenuItem>
                          )}
                          {order.status === "approved" && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "received"); }}>
                              <Truck className="mr-2 h-4 w-4" />Teslim Alındı
                            </DropdownMenuItem>
                          )}
                          {order.status !== "cancelled" && order.status !== "received" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "cancelled"); }}>
                                <XCircle className="mr-2 h-4 w-4" />İptal Et
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <PackagePlus className="mx-auto h-10 w-10 mb-3 opacity-30" />
                    <p>Sipariş bulunamadı</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      {showDetail && (
        <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackagePlus className="h-5 w-5 text-primary" />{showDetail.orderNo}
              </DialogTitle>
              <DialogDescription>{showDetail.supplierName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Durum</span>
                <Badge className={`${statusConfig[showDetail.status].color}`}>{statusConfig[showDetail.status].label}</Badge>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">Kalemler</p>
                {showDetail.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>{item.productName}</span>
                    <span className="tabular-nums">{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold">
                <span>Toplam</span>
                <span>{formatCurrency(showDetail.totalAmount)}</span>
              </div>
              {showDetail.expectedDate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Beklenen Teslim</span>
                  <span>{new Date(showDetail.expectedDate).toLocaleDateString("tr-TR")}</span>
                </div>
              )}
              {showDetail.status !== "received" && showDetail.status !== "cancelled" && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Durum Değiştir</p>
                    <div className="flex flex-wrap gap-2">
                      {showDetail.status !== "draft" && (
                        <Button size="sm" variant="outline" onClick={() => { updateStatus(showDetail.id, "draft"); setShowDetail({ ...showDetail, status: "draft" }); }}>
                          <Clock className="mr-1.5 h-3.5 w-3.5" />Taslağa Dön
                        </Button>
                      )}
                      {showDetail.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => { updateStatus(showDetail.id, "pending"); setShowDetail({ ...showDetail, status: "pending" }); }}>
                          <Clock className="mr-1.5 h-3.5 w-3.5 text-amber-500" />Onaya Gönder
                        </Button>
                      )}
                      {showDetail.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => { updateStatus(showDetail.id, "approved"); setShowDetail({ ...showDetail, status: "approved" }); }}>
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-blue-500" />Onayla
                        </Button>
                      )}
                      {showDetail.status === "approved" && (
                        <Button size="sm" variant="outline" onClick={() => { updateStatus(showDetail.id, "received"); setShowDetail({ ...showDetail, status: "received" }); }}>
                          <Truck className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />Teslim Alındı
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { updateStatus(showDetail.id, "cancelled"); setShowDetail({ ...showDetail, status: "cancelled" }); }}>
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />İptal Et
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetail(null)}>Kapat</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Satın Alma Siparişi</DialogTitle>
            <DialogDescription>Tedarikçiye sipariş oluşturun</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Tedarikçi *</Label>
              <Select value={form.supplierId} onValueChange={(v) => setForm({ ...form, supplierId: v || "" })}>
                <SelectTrigger><SelectValue placeholder="Tedarikçi seçin" /></SelectTrigger>
                <SelectContent>
                  {demoSuppliers.filter((s) => s.isActive).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Ürün *</Label>
              <Select value={form.productId} onValueChange={(v) => setForm({ ...form, productId: v || "" })}>
                <SelectTrigger><SelectValue placeholder="Ürün seçin" /></SelectTrigger>
                <SelectContent>
                  {demoProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Miktar *</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label>Birim Fiyat</Label>
                <Input type="number" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} placeholder="Otomatik" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Beklenen Teslim Tarihi</Label>
              <Input type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Not</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Sipariş notu..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>İptal</Button>
            <Button onClick={handleAdd}>Sipariş Oluştur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
