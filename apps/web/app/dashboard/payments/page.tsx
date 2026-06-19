"use client";

import { useEffect, useState } from "react";
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, Trash2 } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PageHeader, EmptyState, ConfirmDialog } from "@/components/shared";
import { listPayments, recordPayment, deletePayment, getCustomers, getSuppliers } from "@/lib/actions";
import type { PaymentRow } from "@/lib/actions";
import type { Customer, Supplier } from "@/lib/types";

type PaymentMethodValue = "cash" | "card" | "bank_transfer" | "credit" | "check" | "other";

const methodLabel: Record<string, string> = {
  cash: "Nakit", card: "Kart", bank_transfer: "Havale/EFT", credit: "Veresiye", check: "Çek/Senet", other: "Diğer",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filter, setFilter] = useState<"all" | "inbound" | "outbound">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [method, setMethod] = useState<PaymentMethodValue>("cash");
  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const refresh = () => {
    listPayments(filter === "all" ? undefined : { direction: filter }).then((r) => {
      if (r.ok) setPayments(r.data);
      else toast.error(r.error.message);
      setLoading(false);
    });
  };

  useEffect(refresh, [filter]);
  useEffect(() => {
    getCustomers().then((r) => { if (r.ok) setCustomers(r.data); });
    getSuppliers().then((r) => { if (r.ok) setSuppliers(r.data); });
  }, []);

  const openAdd = (dir: "inbound" | "outbound") => {
    setDirection(dir); setMethod("cash"); setPartyId(""); setAmount(""); setReference(""); setNotes("");
    setShowAdd(true);
  };

  const handleAdd = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) { toast.error("Geçerli bir tutar girin"); return; }
    if (!partyId) { toast.error(direction === "inbound" ? "Müşteri seçin" : "Tedarikçi seçin"); return; }
    const r = await recordPayment({
      direction,
      method,
      amount: amt,
      customerId: direction === "inbound" ? partyId : undefined,
      supplierId: direction === "outbound" ? partyId : undefined,
      reference: reference || undefined,
      notes: notes || undefined,
    });
    if (r.ok) { toast.success(direction === "inbound" ? "Tahsilat kaydedildi" : "Ödeme kaydedildi"); setShowAdd(false); refresh(); }
    else { toast.error(r.error.message); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const r = await deletePayment(deleteId);
    if (r.ok) { toast.success("Silindi"); refresh(); } else { toast.error(r.error.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Ödemeler"
        description="Tahsilat (müşteriden) ve tediye (tedarikçiye) kayıtları"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openAdd("outbound")}><ArrowUpRight className="mr-2 h-4 w-4" />Ödeme Yap</Button>
            <Button onClick={() => openAdd("inbound")}><Plus className="mr-2 h-4 w-4" />Tahsilat Al</Button>
          </div>
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">Tümü</TabsTrigger>
          <TabsTrigger value="inbound">Tahsilat</TabsTrigger>
          <TabsTrigger value="outbound">Ödeme</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">{[1, 2, 3].map((i) => (<div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />))}</div>
          ) : payments.length === 0 ? (
            <EmptyState icon={Wallet} title="Kayıt yok" description="İlk tahsilat veya ödemenizi kaydedin." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Yön</TableHead>
                  <TableHead>Taraf</TableHead>
                  <TableHead>Yöntem</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCell>
                      {p.direction === "inbound" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"><ArrowDownLeft className="mr-1 h-3 w-3" />Tahsilat</Badge>
                      ) : (
                        <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-[10px]"><ArrowUpRight className="mr-1 h-3 w-3" />Ödeme</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{p.partyName}</TableCell>
                    <TableCell className="text-sm">{methodLabel[p.method] ?? p.method}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.reference || p.notes || "—"}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${p.direction === "inbound" ? "text-emerald-600" : "text-rose-600"}`}>
                      {p.direction === "inbound" ? "+" : "−"}{formatCurrency(p.amount)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.paidAt).toLocaleDateString("tr-TR")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{direction === "inbound" ? "Tahsilat Al" : "Ödeme Yap"}</DialogTitle>
            <DialogDescription>{direction === "inbound" ? "Müşteriden alınan tutar" : "Tedarikçiye yapılan ödeme"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>{direction === "inbound" ? "Müşteri *" : "Tedarikçi *"}</Label>
              <Select value={partyId} onValueChange={(v) => setPartyId(v || "")}>
                <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>
                  {(direction === "inbound" ? customers : suppliers).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Tutar (₺) *</Label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
              </div>
              <div className="grid gap-2">
                <Label>Yöntem</Label>
                <Select value={method} onValueChange={(v) => setMethod((v || "cash") as PaymentMethodValue)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Nakit</SelectItem>
                    <SelectItem value="card">Kart</SelectItem>
                    <SelectItem value="bank_transfer">Havale/EFT</SelectItem>
                    <SelectItem value="check">Çek/Senet</SelectItem>
                    <SelectItem value="other">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Referans / Belge No</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <div className="grid gap-2"><Label>Not</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>İptal</Button>
            <Button onClick={handleAdd}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Ödeme kaydı silinsin mi?"
        description="Bağlı sipariş/satışın ödenen tutarı geri alınır. Bu işlem geri alınamaz."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={handleDelete}
      />
    </div>
  );
}
