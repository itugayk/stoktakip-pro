"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared";
import { shipSalesOrder } from "@/lib/actions";

const CARRIERS = ["Aras Kargo", "Yurtiçi Kargo", "MNG Kargo", "PTT Kargo", "Sürat Kargo", "Diğer"];

export default function ShipSalesOrderPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [form, setForm] = useState({
    carrier: CARRIERS[0],
    trackingNumber: "",
    shipDate: new Date().toISOString().slice(0, 10),
    waybill: "",
    invoiceNo: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.carrier) {
      toast.error("Kargo firması seçin");
      return;
    }
    setSubmitting(true);
    const result = await shipSalesOrder({
      orderId,
      carrier: form.carrier,
      trackingNumber: form.trackingNumber || undefined,
      shipDate: form.shipDate || undefined,
      waybill: form.waybill || undefined,
      invoiceNo: form.invoiceNo || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Sevkedildi`, {
      description: `${result.data.movementsCreated} stok çıkış hareketi.`,
    });
    router.push("/dashboard/orders/sales");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Sevkiyat"
        description="Kargo bilgilerini girip stok çıkışını onaylayın"
        breadcrumb={[
          { label: "Satış", href: "/dashboard/orders/sales" },
          { label: "Sevkiyat" },
        ]}
      />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid gap-2">
            <Label>Kargo Firması *</Label>
            <Select value={form.carrier} onValueChange={(v) => v && setForm({ ...form, carrier: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARRIERS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Takip No</Label>
              <Input
                value={form.trackingNumber}
                onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })}
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label>Sevk Tarihi</Label>
              <Input
                type="date"
                value={form.shipDate}
                onChange={(e) => setForm({ ...form, shipDate: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>İrsaliye No</Label>
              <Input
                value={form.waybill}
                onChange={(e) => setForm({ ...form, waybill: e.target.value })}
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label>Fatura No</Label>
              <Input
                value={form.invoiceNo}
                onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
                className="font-mono"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notlar</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Müşteriye iletilecek notlar"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Geri
        </Button>
        <Button onClick={submit} disabled={submitting} size="lg">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
          Sevket
        </Button>
      </div>
    </div>
  );
}
