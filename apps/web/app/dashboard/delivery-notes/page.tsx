"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, Printer, Trash2, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/shared";
import {
  listDeliveryNotes, createDeliveryNote, getDeliveryNote, deleteDeliveryNote,
  getSales, getSalesOrders, getPurchaseOrders,
} from "@/lib/actions";
import type { DeliveryNoteRow, SaleRow, SalesOrderRow, PurchaseOrderRow } from "@/lib/actions";
import { generateDeliveryNotePdf } from "@/lib/pdf/delivery-note-pdf";

const statusLabel: Record<string, string> = {
  draft: "Taslak", issued: "Düzenlendi", delivered: "Teslim Edildi", cancelled: "İptal",
};

export default function DeliveryNotesPage() {
  const [notes, setNotes] = useState<DeliveryNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "outbound" | "inbound">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // create form
  const [type, setType] = useState<"outbound" | "inbound">("outbound");
  const [sourceKind, setSourceKind] = useState<"sale" | "salesOrder" | "purchaseOrder">("sale");
  const [sourceId, setSourceId] = useState("");
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderRow[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);

  const refresh = () => {
    listDeliveryNotes(filter === "all" ? undefined : { type: filter }).then((r) => {
      if (r.ok) setNotes(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  };
  useEffect(refresh, [filter]);

  const openAdd = () => {
    setType("outbound"); setSourceKind("sale"); setSourceId("");
    setShowAdd(true);
    getSales(undefined).then((r) => { if (r.ok) setSales(r.data.filter((s) => s.status === "completed")); });
    getSalesOrders(undefined).then((r) => { if (r.ok) setSalesOrders(r.data); });
    getPurchaseOrders(undefined).then((r) => { if (r.ok) setPurchaseOrders(r.data); });
  };

  const handleCreate = async () => {
    if (!sourceId) { toast.error("Kaynak belge seçin"); return; }
    const args =
      sourceKind === "sale" ? { type, fromSaleId: sourceId }
      : sourceKind === "salesOrder" ? { type, fromSalesOrderId: sourceId }
      : { type, fromPurchaseOrderId: sourceId };
    const r = await createDeliveryNote(args);
    if (r.ok) { toast.success(`İrsaliye oluşturuldu: ${r.data.noteNumber}`); setShowAdd(false); refresh(); }
    else { toast.error(r.error.message); }
  };

  const print = async (id: string) => {
    const r = await getDeliveryNote(id);
    if (!r.ok || !r.data) { toast.error("İrsaliye alınamadı"); return; }
    const d = r.data;
    generateDeliveryNotePdf({
      type: d.type,
      noteNumber: d.noteNumber,
      issueDate: d.issueDate,
      party: d.party,
      company: d.company,
      items: d.items.map((it) => ({ name: it.name, sku: it.sku, quantity: it.quantity, unit: it.unit, lotNumber: it.lotNumber })),
      notes: d.notes,
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const r = await deleteDeliveryNote(deleteId);
    if (r.ok) { toast.success("İrsaliye silindi"); refresh(); } else { toast.error(r.error.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="İrsaliyeler"
        description="Sevk (müşteri) ve alış (tedarikçi) irsaliyeleri — yazdırılabilir"
        actions={<Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Yeni İrsaliye</Button>}
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">Tümü</TabsTrigger>
          <TabsTrigger value="outbound">Sevk (Çıkış)</TabsTrigger>
          <TabsTrigger value="inbound">Alış (Giriş)</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">{[1, 2, 3].map((i) => (<div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />))}</div>
          ) : notes.length === 0 ? (
            <EmptyState icon={FileText} title="İrsaliye yok" description="Satış veya siparişten irsaliye oluşturun." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İrsaliye No</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Taraf</TableHead>
                  <TableHead className="text-center">Kalem</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="text-right w-[120px]">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((n) => (
                  <TableRow key={n.id} className="group">
                    <TableCell className="font-mono text-sm font-medium">{n.noteNumber}</TableCell>
                    <TableCell>
                      {n.type === "outbound" ? (
                        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]"><ArrowUpRight className="mr-1 h-3 w-3" />Sevk</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"><ArrowDownLeft className="mr-1 h-3 w-3" />Alış</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{n.partyName}</TableCell>
                    <TableCell className="text-center text-sm">{n.itemCount}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{statusLabel[n.status] ?? n.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{n.issueDate}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => print(n.id)} title="PDF Yazdır">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100" onClick={() => setDeleteId(n.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni İrsaliye</DialogTitle>
            <DialogDescription>Bir satış veya siparişten irsaliye oluşturun</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Tür</Label>
              <Select
                value={type}
                onValueChange={(v) => {
                  const t = (v || "outbound") as "outbound" | "inbound";
                  setType(t);
                  setSourceKind(t === "outbound" ? "sale" : "purchaseOrder");
                  setSourceId("");
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Sevk İrsaliyesi (müşteriye)</SelectItem>
                  <SelectItem value="inbound">Alış İrsaliyesi (tedarikçiden)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === "outbound" && (
              <div className="grid gap-2">
                <Label>Kaynak</Label>
                <Select value={sourceKind} onValueChange={(v) => { setSourceKind(v as "sale" | "salesOrder"); setSourceId(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">Hızlı Satış</SelectItem>
                    <SelectItem value="salesOrder">Satış Siparişi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Belge *</Label>
              <Select value={sourceId} onValueChange={(v) => setSourceId(v || "")}>
                <SelectTrigger><SelectValue placeholder="Belge seçin" /></SelectTrigger>
                <SelectContent>
                  {type === "inbound"
                    ? purchaseOrders.map((o) => (<SelectItem key={o.id} value={o.id}>{o.orderNumber} — {o.supplierName}</SelectItem>))
                    : sourceKind === "sale"
                    ? sales.map((s) => (<SelectItem key={s.id} value={s.id}>{s.saleNumber} — {s.customerName}</SelectItem>))
                    : salesOrders.map((o) => (<SelectItem key={o.id} value={o.id}>{o.orderNumber} — {o.customerName}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>İptal</Button>
            <Button onClick={handleCreate}>Oluştur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="İrsaliye silinsin mi?"
        description="Bu işlem geri alınamaz."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={handleDelete}
      />
    </div>
  );
}
