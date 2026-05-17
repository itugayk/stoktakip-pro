"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, PackagePlus, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import { receivePurchaseOrder } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { scanDetector } from "@/lib/scan-detector";
import { feedback } from "@/lib/feedback";

interface POLineRaw {
  id: string;
  product_id: string;
  quantity: number;
  received_quantity: number;
  unit_price: number;
  product?: { name: string; sku: string; barcode?: string | null } | { name: string; sku: string; barcode?: string | null }[] | null;
}

interface OrderLine {
  itemId: string;
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  ordered: number;
  alreadyReceived: number;
  remaining: number;
  receiving: number;
  lotNumber: string;
  expiryDate: string;
  rejected: number;
  rejectionReason: string;
}

export default function ReceivePurchaseOrderPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [lines, setLines] = useState<OrderLine[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: order } = await supabase
        .from("purchase_orders")
        .select("order_number")
        .eq("id", orderId)
        .maybeSingle();
      if (order) setOrderNumber(order.order_number);

      const { data: items } = await supabase
        .from("purchase_order_items")
        .select(`
          id, product_id, quantity, received_quantity, unit_price,
          product:products(name, sku, barcode)
        `)
        .eq("order_id", orderId);

      const rows = (items as POLineRaw[] | null)?.map((it): OrderLine => {
        const productRaw = it.product;
        const product = Array.isArray(productRaw) ? productRaw[0] : productRaw;
        const remaining = Number(it.quantity) - Number(it.received_quantity ?? 0);
        return {
          itemId: it.id,
          productId: it.product_id,
          name: product?.name ?? "Bilinmeyen",
          sku: product?.sku ?? "",
          barcode: product?.barcode ?? undefined,
          ordered: Number(it.quantity),
          alreadyReceived: Number(it.received_quantity ?? 0),
          remaining,
          receiving: Math.max(0, remaining),
          lotNumber: "",
          expiryDate: "",
          rejected: 0,
          rejectionReason: "",
        };
      }) ?? [];
      setLines(rows);
      setLoading(false);
    }
    load();
  }, [orderId]);

  // HID scanner: a successful scan increments `receiving` on the matched line.
  useEffect(() => {
    return scanDetector.start({
      onScan: (code) => {
        const idx = lines.findIndex((l) => l.barcode === code || l.sku === code.toUpperCase());
        if (idx === -1) {
          feedback.error();
          toast.error("Bu sipariş içinde eşleşen ürün yok", { description: code });
          return;
        }
        const line = lines[idx];
        if (line.receiving >= line.remaining) {
          feedback.warn();
          toast.warning("Bu kalem tamam", { description: line.name });
          return;
        }
        feedback.ok();
        update(idx, { receiving: line.receiving + 1 });
      },
    });
  }, [lines]);

  const update = (i: number, patch: Partial<OrderLine>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const submit = async () => {
    const payload = lines
      .filter((l) => l.receiving > 0 || l.rejected > 0)
      .map((l) => ({
        itemId: l.itemId,
        quantity: l.receiving,
        lotNumber: l.lotNumber || undefined,
        expiryDate: l.expiryDate || undefined,
        rejected: l.rejected || undefined,
        rejectionReason: l.rejectionReason || undefined,
      }));
    if (payload.length === 0) {
      toast.error("Hiç kalem alınmadı");
      return;
    }
    setSubmitting(true);
    const result = await receivePurchaseOrder({ orderId, lines: payload });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Mal kabul tamam`, {
      description: `${result.data.movementsCreated} hareket. Durum: ${result.data.status}`,
    });
    router.push("/dashboard/orders/purchase");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`Mal Kabul · ${orderNumber}`}
        description={`${lines.length} kalem`}
        breadcrumb={[
          { label: "Satın Alma", href: "/dashboard/orders/purchase" },
          { label: "Mal Kabul" },
        ]}
        actions={
          <>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Geri
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Mal Kabulu Tamamla
            </Button>
          </>
        }
      />

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ScanLine className="h-4 w-4 text-primary shrink-0" />
          Barkod / SKU okutulduğunda eşleşen satır otomatik +1 olur.
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : lines.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={PackagePlus}
              title="Bu siparişte kalem yok"
              description="Mal kabul edilecek satır bulunamadı."
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
                  <TableHead className="text-right">Sipariş</TableHead>
                  <TableHead className="text-right">Alınan</TableHead>
                  <TableHead className="text-right">Kalan</TableHead>
                  <TableHead className="w-24">Bu Sefer</TableHead>
                  <TableHead className="w-36">Lot</TableHead>
                  <TableHead className="w-36">SKT</TableHead>
                  <TableHead className="text-right w-20">Red</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={l.itemId} className={l.remaining === 0 ? "opacity-60" : ""}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{l.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{l.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.ordered}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{l.alreadyReceived}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={l.remaining > 0 ? "secondary" : "default"} className="tabular-nums">
                        {l.remaining}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={l.receiving}
                        onChange={(e) => update(i, { receiving: Math.max(0, Number(e.target.value) || 0) })}
                        className="h-8 text-right tabular-nums"
                        min={0}
                        max={l.remaining}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={l.lotNumber}
                        onChange={(e) => update(i, { lotNumber: e.target.value })}
                        className="h-8 font-mono text-xs"
                        placeholder="Lot no"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={l.expiryDate}
                        onChange={(e) => update(i, { expiryDate: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={l.rejected}
                        onChange={(e) => update(i, { rejected: Math.max(0, Number(e.target.value) || 0) })}
                        className="h-8 text-right tabular-nums"
                        min={0}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
