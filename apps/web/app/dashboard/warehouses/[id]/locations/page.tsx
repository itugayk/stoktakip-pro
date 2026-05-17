"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, QrCode as QrCodeIcon, Printer, Loader2 } from "lucide-react";
import QRCode from "qrcode";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/shared";
import {
  listLocations,
  createLocation,
  deleteLocation,
  type WarehouseLocation,
} from "@/lib/actions";

function buildLocationUrl(locationId: string): string {
  if (typeof window === "undefined") return `/dashboard/scanner?mode=location&id=${locationId}`;
  return `${window.location.origin}/dashboard/scanner?mode=location&id=${locationId}`;
}

export default function WarehouseLocationsPage() {
  const params = useParams<{ id: string }>();
  const warehouseId = params.id;

  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<WarehouseLocation | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    listLocations({ warehouseId }).then((r) => {
      if (r.ok) setLocations(r.data);
      setLoading(false);
    });
  };

  useEffect(refresh, [warehouseId]);

  useEffect(() => {
    if (!qrFor) {
      setQrDataUrl(null);
      return;
    }
    const url = buildLocationUrl(qrFor.id);
    QRCode.toDataURL(url, { width: 280, margin: 1 })
      .then(setQrDataUrl)
      .catch((e) => toast.error("QR oluşturulamadı", { description: String(e) }));
  }, [qrFor]);

  const submitAdd = async () => {
    if (!form.name.trim()) {
      toast.error("Lokasyon adı zorunlu");
      return;
    }
    const result = await createLocation({
      warehouseId,
      name: form.name,
      description: form.description || undefined,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Lokasyon eklendi");
    setForm({ name: "", description: "" });
    setShowAdd(false);
    refresh();
  };

  const submitDelete = async () => {
    if (!deleteId) return;
    const r = await deleteLocation(deleteId);
    if (r.ok) {
      toast.success("Lokasyon silindi");
      refresh();
    } else {
      toast.error(r.error.message);
    }
  };

  const printAllQrs = async () => {
    if (locations.length === 0) return;
    const win = window.open("", "_blank", "width=600,height=800");
    if (!win) {
      toast.error("Popup engelleyici aktif");
      return;
    }
    const blocks: string[] = [];
    for (const loc of locations) {
      const url = buildLocationUrl(loc.id);
      // eslint-disable-next-line no-await-in-loop
      const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1 });
      blocks.push(`
        <div class="label">
          <img src="${dataUrl}" alt="QR" />
          <p class="name">${loc.name}</p>
          ${loc.description ? `<p class="desc">${loc.description}</p>` : ""}
        </div>
      `);
    }
    win.document.write(`
      <!DOCTYPE html><html><head><title>Lokasyon QR'leri</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; padding: 16px; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .label { border: 2px dashed #ccc; padding: 12px; text-align: center; page-break-inside: avoid; }
        .label img { max-width: 100%; height: auto; }
        .name { font-size: 14px; font-weight: 700; margin-top: 6px; }
        .desc { font-size: 10px; color: #666; }
        @media print { .label { border: none; } }
      </style></head><body>
      <div class="grid">${blocks.join("")}</div>
      <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Raf / Lokasyon Yönetimi"
        description={`${locations.length} lokasyon`}
        breadcrumb={[
          { label: "Depolar", href: "/dashboard/warehouses" },
          { label: "Lokasyonlar" },
        ]}
        actions={
          <>
            <Button variant="outline" onClick={printAllQrs} disabled={locations.length === 0}>
              <Printer className="mr-2 h-4 w-4" />
              Tümünü Yazdır
            </Button>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Yeni Lokasyon
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : locations.length === 0 ? (
            <EmptyState
              icon={QrCodeIcon}
              title="Henüz lokasyon yok"
              description="Stokları konumlandırmak için raflar ekleyin (ör. A-1-3)."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lokasyon</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="text-right w-[120px]">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono font-medium">{l.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.description || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setQrFor(l)}
                        aria-label="QR göster"
                      >
                        <QrCodeIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteId(l.id)}
                        aria-label="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Yeni Lokasyon</DialogTitle>
            <DialogDescription>Örnek: A-1-3 (Koridor-Raf-Bölme)</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Ad *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
                placeholder="A-1-3"
                className="font-mono"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Açıklama</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Soğuk hava deposu"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>İptal</Button>
            <Button onClick={submitAdd}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{qrFor?.name}</DialogTitle>
            <DialogDescription>
              Bu QR'i rafa yapıştırın. Tarayıcı ile okutulduğunda doğrudan bu lokasyonun stoklarına gider.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR" className="rounded bg-white p-2" />
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (qrDataUrl) {
                  const a = document.createElement("a");
                  a.href = qrDataUrl;
                  a.download = `lokasyon-${qrFor?.name}.png`;
                  a.click();
                }
              }}
              disabled={!qrDataUrl}
            >
              PNG İndir
            </Button>
            <Button onClick={() => setQrFor(null)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Lokasyon silinsin mi?"
        description="Bu lokasyona bağlı envanter kayıtları korunur."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={submitDelete}
      />
    </div>
  );
}
