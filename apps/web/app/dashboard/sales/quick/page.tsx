"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart, Search, Plus, Minus, Trash2, ScanLine, CheckCircle2, Printer, Receipt, Camera,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import { getProducts, getWarehouses, getCustomers, createSale, getSale, createDeliveryNote } from "@/lib/actions";
import { generateDeliveryNotePdf } from "@/lib/pdf/delivery-note-pdf";
import { scanDetector } from "@/lib/scan-detector";
import { feedback, setFeedbackEnabled } from "@/lib/feedback";
import { CameraScanOverlay, type ScanResultInfo } from "@/components/scanner/camera-scan-overlay";
import type { ProductWithStock, Warehouse, Customer } from "@/lib/types";

type PaymentMethodValue = "cash" | "card" | "bank_transfer" | "credit" | "check";

interface CartItem {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

const WALK_IN = "walk-in";

export default function QuickSalePage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [customerId, setCustomerId] = useState<string>(WALK_IN);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("cash");
  const [downPayment, setDownPayment] = useState("");
  const [discount, setDiscount] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ saleId: string; saleNumber: string; total: number } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResultInfo | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setFeedbackEnabled(soundEnabled); }, [soundEnabled]);

  useEffect(() => {
    getProducts(undefined).then((r) => { if (r.ok) setProducts(r.data); });
    getWarehouses().then((r) => { if (r.ok) { setWarehouses(r.data); if (r.data[0]) setWarehouseId(r.data[0].id); } });
    getCustomers().then((r) => { if (r.ok) setCustomers(r.data); });
  }, []);

  const addToCart = useCallback((p: ProductWithStock) => {
    setCart((prev) => {
      const i = prev.findIndex((c) => c.productId === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [...prev, { productId: p.id, name: p.name, sku: p.sku, unitPrice: p.salePrice, quantity: 1 }];
    });
  }, []);

  // Shared scan handler for both the camera overlay and HID/USB hardware scanners.
  const handleScan = useCallback((code: string, format?: string) => {
    const norm = code.trim();
    if (!norm) return;
    const p = products.find((x) => x.barcode === norm || x.sku === norm.toUpperCase());
    setScanCount((c) => c + 1);
    if (p) {
      feedback.ok();
      addToCart(p);
      setScanResult({ seq: Date.now(), found: true, title: p.name, subtitle: `${formatCurrency(p.salePrice)} • sepete eklendi`, code: norm });
      if (!cameraOpen) toast.success(`${p.name} sepete eklendi`, { duration: 1500 });
    } else {
      feedback.error();
      setScanResult({ seq: Date.now(), found: false, title: "Ürün bulunamadı", subtitle: format, code: norm });
      if (!cameraOpen) toast.error("Ürün bulunamadı", { description: norm, duration: 1500 });
    }
  }, [products, addToCart, cameraOpen]);

  // Hardware/USB scanner support — page-wide.
  useEffect(() => scanDetector.start({ onScan: (code) => handleScan(code) }), [handleScan]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 24);
    const q = search.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? "").includes(q))
      .slice(0, 24);
  }, [products, search]);

  const setQty = (productId: string, qty: number) => {
    if (qty <= 0) { setCart((prev) => prev.filter((c) => c.productId !== productId)); return; }
    setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, quantity: qty } : c)));
  };
  const setPrice = (productId: string, price: number) =>
    setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, unitPrice: price } : c)));

  const subtotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);
  const discountNum = Number(discount) || 0;
  const netTotal = Math.max(0, subtotal - discountNum);

  const reset = () => {
    setCart([]); setDiscount(""); setDownPayment(""); setCustomerId(WALK_IN); setPaymentMethod("cash"); setSearch("");
  };

  const handleSell = async () => {
    if (cart.length === 0) { toast.error("Sepet boş"); return; }
    if (!warehouseId) { toast.error("Depo seçin"); return; }
    if (paymentMethod === "credit" && customerId === WALK_IN) {
      toast.error("Veresiye için müşteri seçmelisiniz"); return;
    }
    setSaving(true);
    const paidAmount =
      paymentMethod === "credit" ? (downPayment ? Number(downPayment) : 0) : undefined;
    const r = await createSale({
      customerId: customerId === WALK_IN ? undefined : customerId,
      warehouseId,
      paymentMethod,
      paidAmount,
      discount: discountNum,
      items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.unitPrice })),
    });
    setSaving(false);
    if (!r.ok) { toast.error(r.error.message); return; }
    feedback.ok();
    // Re-fetch for the tax-inclusive total to show on the receipt.
    const detail = await getSale(r.data.saleId);
    const total = detail.ok && detail.data ? detail.data.totalAmount : netTotal;
    setDone({ saleId: r.data.saleId, saleNumber: r.data.saleNumber, total });
    reset();
    getProducts(undefined).then((res) => { if (res.ok) setProducts(res.data); });
  };

  const printReceipt = async () => {
    if (!done) return;
    const r = await getSale(done.saleId);
    if (!r.ok || !r.data) { toast.error("Fiş alınamadı"); return; }
    const s = r.data;
    generateDeliveryNotePdf({
      type: "outbound",
      noteNumber: s.saleNumber,
      issueDate: new Date(s.createdAt).toLocaleDateString("tr-TR"),
      party: s.customer,
      company: s.company,
      items: s.items.map((it) => ({ name: it.name, sku: it.sku, quantity: it.quantity, unit: "adet" })),
      notes: `Toplam: ${formatCurrency(s.totalAmount)} • Ödeme: ${s.paymentMethod}`,
    });
  };

  const makeDeliveryNote = async () => {
    if (!done) return;
    const r = await createDeliveryNote({ type: "outbound", fromSaleId: done.saleId });
    if (r.ok) toast.success(`İrsaliye oluşturuldu: ${r.data.noteNumber}`);
    else toast.error(r.error.message);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader
        title="Hızlı Satış"
        description="Ürün tara/ekle, ödemeyi seç, sat — stok anında düşer"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:flex items-center gap-1"><ScanLine className="h-3.5 w-3.5" />Okuyucu aktif</Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Product picker */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                autoFocus
                placeholder="Ürün adı, SKU veya barkod ara / tara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-12"
              />
            </div>
            <Button variant="outline" className="h-12 shrink-0" onClick={() => { setScanResult(null); setCameraOpen(true); }}>
              <Camera className="h-5 w-5 sm:mr-2" /><span className="hidden sm:inline">Kamera</span>
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="text-left rounded-xl border border-border bg-card p-3 hover:border-primary hover:shadow-md transition-all active:scale-[0.98]"
              >
                <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-primary">{formatCurrency(p.salePrice)}</span>
                  <span className={`text-[10px] ${p.availableStock <= 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                    {p.availableStock} {p.unit}
                  </span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-10 text-muted-foreground text-sm">Ürün bulunamadı</div>
            )}
          </div>
        </div>

        {/* Cart */}
        <Card className="lg:sticky lg:top-4 h-fit">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold"><ShoppingCart className="h-4 w-4 text-primary" />Sepet ({cart.length})</div>

            <div className="max-h-[36vh] overflow-y-auto divide-y divide-border -mx-1 px-1">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Sepet boş — ürün ekleyin</p>
              ) : cart.map((c) => (
                <div key={c.productId} className="py-2 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight">{c.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setQty(c.productId, 0)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(c.productId, c.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                      <Input
                        type="number"
                        value={c.quantity}
                        onChange={(e) => setQty(c.productId, Number(e.target.value))}
                        className="h-7 w-12 text-center px-1"
                      />
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(c.productId, c.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={c.unitPrice}
                      onChange={(e) => setPrice(c.productId, Number(e.target.value))}
                      className="h-7 w-24 text-right font-mono"
                    />
                  </div>
                  <div className="text-right text-xs font-semibold tabular-nums">{formatCurrency(c.quantity * c.unitPrice)}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className="text-xs">Müşteri</Label>
                  <Select value={customerId} onValueChange={(v) => setCustomerId(v || WALK_IN)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={WALK_IN}>Peşin müşteri</SelectItem>
                      {customers.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Depo</Label>
                  <Select value={warehouseId} onValueChange={(v) => setWarehouseId(v || "")}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (<SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className="text-xs">Ödeme</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod((v || "cash") as PaymentMethodValue)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Nakit</SelectItem>
                      <SelectItem value="card">Kart</SelectItem>
                      <SelectItem value="bank_transfer">Havale/EFT</SelectItem>
                      <SelectItem value="credit">Veresiye</SelectItem>
                      <SelectItem value="check">Çek/Senet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">İskonto (₺)</Label>
                  <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-9" placeholder="0" />
                </div>
              </div>

              {paymentMethod === "credit" && (
                <div className="grid gap-1">
                  <Label className="text-xs">Peşinat / Alınan (₺) — opsiyonel</Label>
                  <Input type="number" step="0.01" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} className="h-9" placeholder="0" />
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ara Toplam (KDV hariç)</span>
                <span className="tabular-nums">{formatCurrency(netTotal)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">KDV satış sırasında ürün vergi oranına göre eklenir.</p>

              <Button className="w-full h-12 text-base" disabled={saving || cart.length === 0} onClick={handleSell}>
                <Receipt className="mr-2 h-5 w-5" />{saving ? "Kaydediliyor…" : "Satışı Tamamla"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success dialog */}
      <Dialog open={!!done} onOpenChange={(o) => !o && setDone(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />Satış tamamlandı
            </DialogTitle>
            <DialogDescription>{done?.saleNumber}</DialogDescription>
          </DialogHeader>
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">Toplam</p>
            <p className="text-3xl font-bold tabular-nums">{done ? formatCurrency(done.total) : ""}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={printReceipt}><Printer className="mr-2 h-4 w-4" />Fiş/İrsaliye PDF</Button>
            <Button variant="outline" onClick={makeDeliveryNote}><Receipt className="mr-2 h-4 w-4" />İrsaliye Kaydet</Button>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => { setDone(null); searchRef.current?.focus(); }}>Yeni Satış</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CameraScanOverlay
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={(code, format) => handleScan(code, format)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((s) => !s)}
        showBatch={false}
        hint="Sepete eklemek için barkodu okutun"
        result={scanResult}
        scanCount={scanCount}
      />
    </div>
  );
}
