"use client";

import { useState, useMemo } from "react";
import {
  PackageMinus, Plus, Search, Eye, MoreHorizontal,
  CheckCircle2, Clock, XCircle, Truck, FileText,
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
import { demoCustomers, demoProducts } from "@/lib/demo-data";
import { PageHeader } from "@/components/shared";

type OrderStatus = "draft" | "confirmed" | "shipped" | "delivered" | "cancelled";

interface SalesOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface SalesOrder {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  items: SalesOrderItem[];
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

const statusConfig: Record<OrderStatus, { label: string; icon: typeof Clock; color: string }> = {
  draft: { label: "Taslak", icon: Clock, color: "bg-gray-500/10 text-gray-500 border-gray-500/30" },
  confirmed: { label: "Onaylı", icon: CheckCircle2, color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  shipped: { label: "Kargoda", icon: Truck, color: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  delivered: { label: "Teslim Edildi", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  cancelled: { label: "İptal", icon: XCircle, color: "bg-rose-500/10 text-rose-500 border-rose-500/30" },
};

const demoSalesOrders: SalesOrder[] = [
  {
    id: "so-1", orderNo: "SO-2026-045", customerId: "cust-1", customerName: "Sağlık Eczanesi",
    status: "delivered", totalAmount: 8388,
    items: [
      { productId: "prod-2", productName: "Vitamin C 1000mg", quantity: 120, unitPrice: 69.90 },
    ],
    createdAt: "2026-05-14",
  },
  {
    id: "so-2", orderNo: "SO-2026-046", customerId: "cust-3", customerName: "Online Sağlık Mağazası",
    status: "shipped", totalAmount: 3747.50,
    items: [
      { productId: "prod-8", productName: "Probiyotik Kapsül", quantity: 25, unitPrice: 149.90 },
    ],
    createdAt: "2026-05-12",
  },
  {
    id: "so-3", orderNo: "SO-2026-047", customerId: "cust-2", customerName: "Güneş Market",
    status: "confirmed", totalAmount: 4490,
    items: [
      { productId: "prod-11", productName: "Bebek Bezi No:3 (40'lı)", quantity: 25, unitPrice: 179.60 },
    ],
    createdAt: "2026-05-13",
  },
  {
    id: "so-4", orderNo: "SO-2026-048", customerId: "cust-4", customerName: "Doğa Kozmetik",
    status: "draft", totalAmount: 3250,
    items: [
      { productId: "prod-7", productName: "Nemlendirici Krem 50ml", quantity: 50, unitPrice: 65.00 },
    ],
    createdAt: "2026-05-14",
  },
];

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState(demoSalesOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<SalesOrder | null>(null);
  const [form, setForm] = useState({
    customerId: "", productId: "", quantity: "", unitPrice: "", notes: "",
  });

  const filtered = useMemo(() => {
    let result = [...orders];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((o) => o.orderNo.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") result = result.filter((o) => o.status === statusFilter);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, search, statusFilter]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

  const handleAdd = () => {
    const customer = demoCustomers.find((c) => c.id === form.customerId);
    const product = demoProducts.find((p) => p.id === form.productId);
    if (!customer || !product || !form.quantity) { toast.error("Zorunlu alanları doldurun"); return; }
    const qty = parseInt(form.quantity);
    const price = parseFloat(form.unitPrice) || product.salePrice;
    const so: SalesOrder = {
      id: `so-${Date.now()}`, orderNo: `SO-2026-${String(orders.length + 45).padStart(3, "0")}`,
      customerId: customer.id, customerName: customer.name, status: "draft",
      items: [{ productId: product.id, productName: product.name, quantity: qty, unitPrice: price }],
      totalAmount: qty * price, notes: form.notes || undefined,
      createdAt: new Date().toISOString().split("T")[0],
    };
    setOrders((prev) => [so, ...prev]);
    setShowAdd(false);
    setForm({ customerId: "", productId: "", quantity: "", unitPrice: "", notes: "" });
    toast.success("Satış siparişi oluşturuldu");
  };

  const updateStatus = (id: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    toast.success(`Sipariş durumu: ${statusConfig[status].label}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Satış Siparişleri"
        description={`${filtered.length} sipariş`}
        breadcrumb={[{ label: "Siparişler" }, { label: "Satış" }]}
        actions={
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />Yeni Sipariş
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Sipariş no veya müşteri ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "all")}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="draft">Taslak</SelectItem>
              <SelectItem value="confirmed">Onaylı</SelectItem>
              <SelectItem value="shipped">Kargoda</SelectItem>
              <SelectItem value="delivered">Teslim Edildi</SelectItem>
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
                <TableHead>Müşteri</TableHead>
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
                        <PackageMinus className="h-4 w-4 text-rose-500" />
                        <span className="font-mono font-medium text-sm">{order.orderNo}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{order.customerName}</TableCell>
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
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "confirmed"); }}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />Onayla
                            </DropdownMenuItem>
                          )}
                          {order.status === "confirmed" && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "shipped"); }}>
                              <Truck className="mr-2 h-4 w-4" />Kargoya Ver
                            </DropdownMenuItem>
                          )}
                          {order.status === "shipped" && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateStatus(order.id, "delivered"); }}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />Teslim Edildi
                            </DropdownMenuItem>
                          )}
                          {order.status !== "cancelled" && order.status !== "delivered" && (
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
                    <PackageMinus className="mx-auto h-10 w-10 mb-3 opacity-30" />
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
                <FileText className="h-5 w-5 text-primary" />{showDetail.orderNo}
              </DialogTitle>
              <DialogDescription>{showDetail.customerName}</DialogDescription>
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
              {showDetail.status !== "delivered" && showDetail.status !== "cancelled" && (
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
                        <Button size="sm" variant="outline" onClick={() => { updateStatus(showDetail.id, "confirmed"); setShowDetail({ ...showDetail, status: "confirmed" }); }}>
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-blue-500" />Onayla
                        </Button>
                      )}
                      {showDetail.status === "confirmed" && (
                        <Button size="sm" variant="outline" onClick={() => { updateStatus(showDetail.id, "shipped"); setShowDetail({ ...showDetail, status: "shipped" }); }}>
                          <Truck className="mr-1.5 h-3.5 w-3.5 text-amber-500" />Kargoya Ver
                        </Button>
                      )}
                      {showDetail.status === "shipped" && (
                        <Button size="sm" variant="outline" onClick={() => { updateStatus(showDetail.id, "delivered"); setShowDetail({ ...showDetail, status: "delivered" }); }}>
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />Teslim Edildi
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
            <DialogTitle>Yeni Satış Siparişi</DialogTitle>
            <DialogDescription>Müşteriye sipariş oluşturun</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Müşteri *</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v || "" })}>
                <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                <SelectContent>
                  {demoCustomers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
