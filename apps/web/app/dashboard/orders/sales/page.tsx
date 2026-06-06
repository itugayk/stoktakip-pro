"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PackageMinus, Plus, Search, Eye, MoreHorizontal,
  CheckCircle2, Clock, XCircle, Truck, FileText, Trash2, PackageCheck,
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
import { PageHeader } from "@/components/shared";
import {
  getSalesOrders, createSalesOrder, approveSalesOrder, cancelSalesOrder,
  getCustomers, getProducts, getWarehouses,
  type SalesOrderRow, type SOStatus,
} from "@/lib/actions";

const statusConfig: Record<SOStatus, { label: string; icon: typeof Clock; color: string }> = {
  draft: { label: "Taslak", icon: Clock, color: "bg-gray-500/10 text-gray-500 border-gray-500/30" },
  pending: { label: "Onay Bekliyor", icon: Clock, color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  approved: { label: "Onaylı", icon: CheckCircle2, color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  shipped: { label: "Sevk Edildi", icon: Truck, color: "bg-violet-500/10 text-violet-500 border-violet-500/30" },
  delivered: { label: "Teslim Edildi", icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  cancelled: { label: "İptal", icon: XCircle, color: "bg-rose-500/10 text-rose-500 border-rose-500/30" },
};

interface Option { id: string; name: string }
interface ProductOption { id: string; name: string; sku: string; salePrice: number; currentStock: number }
interface LineForm { productId: string; quantity: string; unitPrice: string }

const emptyLine = (): LineForm => ({ productId: "", quantity: "", unitPrice: "" });

export default function SalesOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<SalesOrderRow[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<SalesOrderRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    customerId: "", warehouseId: "", notes: "", lines: [emptyLine()],
  });

  const refresh = () => {
    getSalesOrders(undefined).then((r) => {
      if (r.ok) setOrders(r.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
    getCustomers().then((r) => r.ok && setCustomers(r.data.map((c) => ({ id: c.id, name: c.name }))));
    getWarehouses().then((r) => r.ok && setWarehouses(r.data.map((w) => ({ id: w.id, name: w.name }))));
    getProducts(undefined).then((r) =>
      r.ok && setProducts(r.data.map((p) => ({
        id: p.id, name: p.name, sku: p.sku, salePrice: p.salePrice, currentStock: p.currentStock,
      })))
    );
  }, []);

  const filtered = useMemo(() => {
    let result = [...orders];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((o) => o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") result = result.filter((o) => o.status === statusFilter);
    return result;
  }, [orders, search, statusFilter]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

  const setLine = (i: number, patch: Partial<LineForm>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  const removeLine = (i: number) =>
    setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));

  const estimatedTotal = useMemo(() => {
    return form.lines.reduce((sum, l) => {
      const p = products.find((pp) => pp.id === l.productId);
      const price = parseFloat(l.unitPrice) || p?.salePrice || 0;
      const qty = parseFloat(l.quantity) || 0;
      return sum + price * qty;
    }, 0);
  }, [form.lines, products]);

  const resetForm = () =>
    setForm({ customerId: "", warehouseId: "", notes: "", lines: [emptyLine()] });

  const handleAdd = () => {
    const items = form.lines
      .filter((l) => l.productId && parseFloat(l.quantity) > 0)
      .map((l) => ({
        productId: l.productId,
        quantity: parseFloat(l.quantity),
        ...(l.unitPrice ? { unitPrice: parseFloat(l.unitPrice) } : {}),
      }));
    if (!form.customerId || !form.warehouseId || items.length === 0) {
      toast.error("Müşteri, depo ve en az bir geçerli kalem girin");
      return;
    }
    startTransition(async () => {
      const r = await createSalesOrder({
        customerId: form.customerId,
        warehouseId: form.warehouseId,
        notes: form.notes || undefined,
        items,
      });
      if (r.ok) {
        toast.success("Satış siparişi oluşturuldu");
        setShowAdd(false);
        resetForm();
        refresh();
      } else {
        toast.error(r.error.message);
      }
    });
  };

  const doApprove = (id: string) =>
    startTransition(async () => {
      const r = await approveSalesOrder({ orderId: id });
      if (r.ok) {
        toast.success("Sipariş onaylandı, stok rezerve edildi");
        setShowDetail(null);
        refresh();
      } else {
        toast.error(r.error.message);
      }
    });

  const doCancel = (id: string) =>
    startTransition(async () => {
      const r = await cancelSalesOrder({ orderId: id });
      if (r.ok) {
        toast.success("Sipariş iptal edildi");
        setShowDetail(null);
        refresh();
      } else {
        toast.error(r.error.message);
      }
    });

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
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              {Object.entries(statusConfig).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
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
                        <span className="font-mono font-medium text-sm">{order.orderNumber}</span>
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
                          {order.status === "pending" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); doApprove(order.id); }}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />Onayla (stok rezerve)
                              </DropdownMenuItem>
                            </>
                          )}
                          {order.status === "approved" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/orders/sales/${order.id}/pick`); }}>
                                <PackageCheck className="mr-2 h-4 w-4" />Topla
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/orders/sales/${order.id}/ship`); }}>
                                <Truck className="mr-2 h-4 w-4" />Sevk Et
                              </DropdownMenuItem>
                            </>
                          )}
                          {(order.status === "draft" || order.status === "pending" || order.status === "approved") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); doCancel(order.id); }}>
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
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <PackageMinus className="mx-auto h-10 w-10 mb-3 opacity-30" />
                    <p>Sipariş bulunamadı</p>
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Yükleniyor…</TableCell>
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
                <FileText className="h-5 w-5 text-primary" />{showDetail.orderNumber}
              </DialogTitle>
              <DialogDescription>{showDetail.customerName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Durum</span>
                <Badge className={`${statusConfig[showDetail.status].color}`}>{statusConfig[showDetail.status].label}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Kalem sayısı</span>
                <span className="tabular-nums">{showDetail.itemCount}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Toplam</span>
                <span>{formatCurrency(showDetail.totalAmount)}</span>
              </div>
              {showDetail.notes && (
                <p className="text-xs text-muted-foreground border-t pt-2 whitespace-pre-wrap">{showDetail.notes}</p>
              )}
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {showDetail.status === "pending" && (
                  <Button size="sm" disabled={pending} onClick={() => doApprove(showDetail.id)}>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Onayla
                  </Button>
                )}
                {showDetail.status === "approved" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/orders/sales/${showDetail.id}/pick`)}>
                      <PackageCheck className="mr-1.5 h-3.5 w-3.5" />Topla
                    </Button>
                    <Button size="sm" onClick={() => router.push(`/dashboard/orders/sales/${showDetail.id}/ship`)}>
                      <Truck className="mr-1.5 h-3.5 w-3.5" />Sevk Et
                    </Button>
                  </>
                )}
                {(showDetail.status === "draft" || showDetail.status === "pending" || showDetail.status === "approved") && (
                  <Button size="sm" variant="outline" disabled={pending} className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => doCancel(showDetail.id)}>
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />İptal Et
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetail(null)}>Kapat</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Satış Siparişi</DialogTitle>
            <DialogDescription>Müşteriye sipariş oluşturun. Onaylandığında stok rezerve edilir.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Müşteri *</Label>
                <Select value={form.customerId} onValueChange={(v) => setForm({ ...form, customerId: v || "" })}>
                  <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Depo *</Label>
                <Select value={form.warehouseId} onValueChange={(v) => setForm({ ...form, warehouseId: v || "" })}>
                  <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Kalemler *</Label>
                <Button type="button" size="sm" variant="ghost" onClick={addLine}>
                  <Plus className="mr-1 h-3.5 w-3.5" />Kalem ekle
                </Button>
              </div>
              {form.lines.map((line, i) => {
                const p = products.find((pp) => pp.id === line.productId);
                return (
                  <div key={i} className="grid grid-cols-[1fr_70px_90px_auto] gap-2 items-end">
                    <Select value={line.productId} onValueChange={(v) => setLine(i, { productId: v || "" })}>
                      <SelectTrigger><SelectValue placeholder="Ürün" /></SelectTrigger>
                      <SelectContent>
                        {products.map((pp) => (
                          <SelectItem key={pp.id} value={pp.id}>
                            {pp.name} · stok: {pp.currentStock}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="number" placeholder="Adet" value={line.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                    <Input type="number" step="0.01" placeholder={p ? String(p.salePrice) : "Fiyat"} value={line.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} />
                    <Button type="button" size="icon" variant="ghost" className="h-9 w-9" disabled={form.lines.length === 1} onClick={() => removeLine(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-2">
              <Label>Not</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Sipariş notu..." />
            </div>

            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Tahmini tutar (KDV hariç)</span>
              <span className="font-semibold tabular-nums">{formatCurrency(estimatedTotal)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>İptal</Button>
            <Button onClick={handleAdd} disabled={pending}>
              {pending ? "Oluşturuluyor…" : "Sipariş Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
