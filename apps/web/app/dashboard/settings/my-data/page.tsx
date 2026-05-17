"use client";

import { useState } from "react";
import { Download, Trash2, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/shared";
import { exportCompanyData, requestCompanyDeletion } from "@/lib/actions";

export default function MyDataPage() {
  const [exporting, setExporting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const downloadXlsx = async () => {
    setExporting(true);
    try {
      const result = await exportCompanyData();
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const wb = XLSX.utils.book_new();

      const sheets: Array<[string, Record<string, unknown>[] | Record<string, unknown> | null]> = [
        ["Şirket", result.data.company ? [result.data.company] : []],
        ["Ürünler", result.data.products],
        ["Envanter", result.data.inventory],
        ["Stok Hareketleri", result.data.stockMovements],
        ["Depolar", result.data.warehouses],
        ["Tedarikçiler", result.data.suppliers],
        ["Müşteriler", result.data.customers],
        ["Satın Alma", result.data.purchaseOrders],
        ["Satış", result.data.salesOrders],
      ];

      for (const [name, rows] of sheets) {
        const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
        const ws = XLSX.utils.json_to_sheet(list);
        XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
      }

      XLSX.writeFile(wb, `stoktakip-veri-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Veriniz indirildi");
    } catch (e) {
      toast.error("İndirilemedi", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setExporting(false);
    }
  };

  const submitDelete = async () => {
    if (!confirmName.trim()) return;
    setSubmitting(true);
    const result = await requestCompanyDeletion({ confirmCompanyName: confirmName });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Hesap silme isteği oluşturuldu", {
      description: "30 gün içinde tüm verileriniz tamamen silinir. Bu süre içinde geri yükleme talep edebilirsiniz.",
    });
    setShowDelete(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="Verilerim"
        description="KVKK kapsamında verilerinizi indirin veya hesabınızı kapatın"
        breadcrumb={[
          { label: "Ayarlar", href: "/dashboard/settings" },
          { label: "Verilerim" },
        ]}
      />

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Verilerimi İndir</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Şirketinize ait tüm veriler (ürünler, envanter, hareketler, siparişler, müşteri/tedarikçi)
                tek bir Excel dosyasında. KVKK m.11 kapsamındaki <strong>veri taşınabilirliği</strong> hakkınız.
              </p>
              <Button className="mt-3" onClick={downloadXlsx} disabled={exporting}>
                {exporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Hazırlanıyor…
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Excel olarak indir
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 shrink-0">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Veri Saklama Politikamız</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li>• Hesabınız aktifken: süresiz saklanır</li>
                <li>• Hesap kapatıldıktan sonra: 30 gün geri yükleme süresi</li>
                <li>• 30 gün sonra: operasyonel veriler tamamen silinir</li>
                <li>• Audit logları yasal gereklilik nedeniyle 10 yıl saklanır</li>
                <li>• Yedekler 90 günlük rotasyonla silinir</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-rose-500/30">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 shrink-0">
              <Trash2 className="h-5 w-5 text-rose-500" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Hesabımı Sil</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Hesabınızı kapatırsanız 30 günlük grace period başlar. Bu süre içinde fikrinizi
                değiştirebilirsiniz. 30 gün sonra tüm operasyonel veriniz <strong>geri yüklenemez şekilde</strong>{" "}
                silinir.
              </p>
              <Button className="mt-3" variant="destructive" onClick={() => setShowDelete(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Hesap Silme Sürecini Başlat
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Hesap silme onayı
            </DialogTitle>
            <DialogDescription>
              Bu işlemi geri almak için 30 gününüz var. Onaylamak için şirket adınızı tam olarak yazın.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label>Şirket Adı *</Label>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Şirketinizin tam adı"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>İptal</Button>
            <Button variant="destructive" onClick={submitDelete} disabled={submitting || !confirmName.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Evet, silme sürecini başlat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
