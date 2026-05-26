"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, ScanLine, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import { recordPick, getSalesOrderForPicking } from "@/lib/actions/orders";
import { scanDetector } from "@/lib/scan-detector";
import { feedback } from "@/lib/feedback";

interface PickLine {
  itemId: string;
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  location?: string;
  needed: number;
  picked: number;
}

export default function PickSalesOrderPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [lines, setLines] = useState<PickLine[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await getSalesOrderForPicking(orderId);
      if (!res.ok || !res.data) {
        setLoading(false);
        return;
      }
      setOrderNumber(res.data.orderNumber);
      const rows: PickLine[] = res.data.lines.map((it) => ({
        itemId: it.itemId,
        productId: it.productId,
        name: it.productName,
        sku: it.productSku,
        barcode: it.productBarcode,
        needed: it.ordered,
        picked: it.alreadyPicked,
      }));
      rows.sort((a, b) => (a.location ?? "").localeCompare(b.location ?? ""));
      setLines(rows);
      setLoading(false);
    }
    load();
  }, [orderId]);

  useEffect(() => {
    return scanDetector.start({
      onScan: (code) => {
        const idx = lines.findIndex((l) => l.barcode === code || l.sku === code.toUpperCase());
        if (idx === -1) {
          feedback.error();
          toast.error("Yanlış ürün taradınız", { description: code });
          return;
        }
        const line = lines[idx];
        if (line.picked >= line.needed) {
          feedback.warn();
          toast.warning("Bu kalem tamam", { description: line.name });
          return;
        }
        feedback.ok();
        update(idx, { picked: line.picked + 1 });
      },
    });
  }, [lines]);

  const update = (i: number, patch: Partial<PickLine>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const allPicked = lines.every((l) => l.picked >= l.needed);

  const submit = async () => {
    setSubmitting(true);
    const result = await recordPick({
      orderId,
      lines: lines.map((l) => ({ itemId: l.itemId, pickedQty: l.picked })),
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(allPicked ? "Toplama tamamlandı — sevkiyata hazır" : "Toplama kaydedildi");
    router.push("/dashboard/orders/sales");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`Toplama · ${orderNumber}`}
        description={`${lines.filter((l) => l.picked >= l.needed).length}/${lines.length} kalem toplandı`}
        breadcrumb={[
          { label: "Satış", href: "/dashboard/orders/sales" },
          { label: "Toplama" },
        ]}
        actions={
          <>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Geri
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Kaydet
            </Button>
          </>
        }
      />

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ScanLine className="h-4 w-4 text-primary shrink-0" />
          Her ürünü tarayarak topladığınızı doğrulayın. Yanlış ürün tararsanız uyarı alırsınız.
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
            <EmptyState icon={ShoppingBasket} title="Bu siparişte kalem yok" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lokasyon</TableHead>
                  <TableHead>Ürün</TableHead>
                  <TableHead className="text-right">Gerekli</TableHead>
                  <TableHead className="text-right">Toplandı</TableHead>
                  <TableHead className="text-center w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => {
                  const done = l.picked >= l.needed;
                  return (
                    <TableRow key={l.itemId} className={done ? "bg-emerald-500/5" : ""}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {l.location ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{l.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{l.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.needed}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={l.picked}
                          onChange={(e) => update(i, { picked: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-8 w-20 ml-auto text-right tabular-nums"
                          min={0}
                          max={l.needed}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {done && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">✓</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
