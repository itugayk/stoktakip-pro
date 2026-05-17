"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ScanLine, CheckCircle2, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/shared";
import {
  getCountDetail,
  recordCountScan,
  closeCount,
  getProducts,
  type StockCountItem,
  type CountStatus,
} from "@/lib/actions";
import type { ProductWithStock } from "@/lib/types";
import { scanDetector } from "@/lib/scan-detector";
import { feedback } from "@/lib/feedback";

export default function CountDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const countId = params.id;

  const [name, setName] = useState("");
  const [status, setStatus] = useState<CountStatus>("open");
  const [items, setItems] = useState<StockCountItem[]>([]);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualCode, setManualCode] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);

  const refresh = useCallback(async () => {
    const [d, p] = await Promise.all([getCountDetail(countId), getProducts(undefined)]);
    if (d.ok && d.data) {
      if (d.data.count) {
        setName(d.data.count.name || `Sayım ${countId.slice(0, 8)}`);
        setStatus(d.data.count.status);
      }
      setItems(d.data.items);
    }
    if (p.ok) setProducts(p.data);
    setLoading(false);
  }, [countId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleScan = useCallback(
    async (code: string) => {
      const product = products.find(
        (p) => p.barcode === code || p.sku === code.toUpperCase()
      );
      if (!product) {
        feedback.error();
        toast.error("Ürün bulunamadı", { description: code, duration: 2000 });
        return;
      }
      // Inc-by-one: each scan adds 1 to the counted_qty of (this product, no lot).
      const existing = items.find((i) => i.productId === product.id && !i.lotNumber);
      const nextQty = (existing?.countedQty ?? 0) + 1;
      const result = await recordCountScan({
        countId,
        productId: product.id,
        countedQty: nextQty,
      });
      if (result.ok) {
        feedback.ok();
        toast.success(product.name, {
          description: `Sayılan: ${nextQty}`,
          duration: 1500,
        });
        await refresh();
      } else {
        feedback.error();
        toast.error(result.error.message);
      }
    },
    [countId, items, products, refresh]
  );

  // HID scanner support — only active when the count is not closed.
  useEffect(() => {
    if (status === "closed" || status === "cancelled") return;
    return scanDetector.start({ onScan: handleScan });
  }, [handleScan, status]);

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    setManualCode("");
    void handleScan(code);
  };

  const handleClose = async () => {
    const result = await closeCount({ countId });
    if (result.ok) {
      toast.success(`Sayım kapatıldı`, {
        description: `${result.data.adjustments} adet düzeltme hareketi oluşturuldu.`,
      });
      router.push("/dashboard/counts");
    } else {
      toast.error(result.error.message);
    }
  };

  const scanned = items.filter((i) => i.countedQty != null);
  const remaining = items.filter((i) => i.countedQty == null);
  const variances = items.filter((i) => i.variance !== 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={name}
        description={status === "closed" ? "Kapalı" : `${scanned.length}/${items.length} kalem sayıldı`}
        breadcrumb={[{ label: "Sayımlar", href: "/dashboard/counts" }, { label: name }]}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href="/dashboard/counts">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Liste
              </a>
            </Button>
            {status !== "closed" && status !== "cancelled" && (
              <Button onClick={() => setConfirmClose(true)} disabled={scanned.length === 0}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Sayımı Onayla
              </Button>
            )}
          </>
        }
      />

      {status !== "closed" && status !== "cancelled" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ScanLine className="h-4 w-4 text-primary" />
              Hızlı Tarama
            </div>
            <div className="flex gap-2">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualSubmit();
                }}
                placeholder="Barkod veya SKU ile sayım…"
                className="font-mono h-12 text-lg"
                autoFocus
                inputMode="numeric"
                enterKeyHint="enter"
              />
              <Button onClick={handleManualSubmit} disabled={!manualCode.trim()} size="lg" className="h-12">
                Say
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              USB / Bluetooth okuyucular doğrudan tarayabilir; her okuma 1 adet sayar.
            </p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Sayım kapsamında ürün yok"
              description="Seçtiğiniz depoda envanter kaydı bulunmuyor."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead className="text-right">Beklenen</TableHead>
                  <TableHead className="text-right">Sayılan</TableHead>
                  <TableHead className="text-right">Fark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const isScanned = it.countedQty != null;
                  const hasVariance = it.variance !== 0;
                  return (
                    <TableRow key={it.id} className={hasVariance ? "bg-amber-500/5" : ""}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{it.productName || "Bilinmeyen"}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {it.productSku}{it.lotNumber && ` • Lot ${it.lotNumber}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{it.expectedQty}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isScanned ? (
                          <Badge variant="secondary">{it.countedQty}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isScanned ? (
                          hasVariance ? (
                            <span
                              className={
                                it.variance > 0
                                  ? "text-emerald-500 font-medium"
                                  : "text-rose-500 font-medium"
                              }
                            >
                              {it.variance > 0 ? "+" : ""}
                              {it.variance}
                            </span>
                          ) : (
                            <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Sayımı kapat?"
        description={
          variances.length > 0
            ? `${variances.length} ürün için düzeltme hareketi oluşturulacak. (${remaining.length} sayılmadı.)`
            : "Sayım kapatılacak ve düzeltme oluşturulmayacak."
        }
        confirmLabel="Kapat ve Düzelt"
        onConfirm={handleClose}
      />

      {remaining.length > 0 && status !== "closed" && (
        <p className="text-xs text-amber-600 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          {remaining.length} kalem henüz sayılmadı.
        </p>
      )}

      {loading && status === "in_progress" && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
