"use client";

import { useEffect, useState } from "react";
import { BookUser, Wallet, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { PageHeader, EmptyState } from "@/components/shared";
import {
  getCustomers, getSuppliers, getPartnerStatement, recordPayment,
} from "@/lib/actions";
import type { StatementRow } from "@/lib/actions";
import type { Customer, Supplier } from "@/lib/types";

type PaymentMethodValue = "cash" | "card" | "bank_transfer" | "check" | "other";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

export default function AccountsPage() {
  const [tab, setTab] = useState<"customer" | "supplier">("customer");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const [stmtOpen, setStmtOpen] = useState(false);
  const [stmtTitle, setStmtTitle] = useState("");
  const [stmtRows, setStmtRows] = useState<StatementRow[]>([]);

  const [payOpen, setPayOpen] = useState(false);
  const [payParty, setPayParty] = useState<{ id: string; name: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethodValue>("cash");

  const refresh = () => {
    Promise.all([getCustomers(), getSuppliers()]).then(([c, s]) => {
      if (c.ok) setCustomers(c.data);
      if (s.ok) setSuppliers(s.data);
      setLoading(false);
    });
  };
  useEffect(refresh, []);

  const openStatement = async (partnerType: "customer" | "supplier", id: string, name: string) => {
    setStmtTitle(name);
    setStmtRows([]);
    setStmtOpen(true);
    const r = await getPartnerStatement({ partnerType, partnerId: id });
    if (r.ok) setStmtRows(r.data);
    else toast.error(r.error.message);
  };

  const openPay = (id: string, name: string) => {
    setPayParty({ id, name }); setAmount(""); setMethod("cash"); setPayOpen(true);
  };

  const handlePay = async () => {
    if (!payParty) return;
    const amt = Number(amount);
    if (!(amt > 0)) { toast.error("Geçerli tutar girin"); return; }
    const r = await recordPayment({
      direction: tab === "customer" ? "inbound" : "outbound",
      method,
      amount: amt,
      customerId: tab === "customer" ? payParty.id : undefined,
      supplierId: tab === "supplier" ? payParty.id : undefined,
    });
    if (r.ok) { toast.success(tab === "customer" ? "Tahsilat kaydedildi" : "Ödeme kaydedildi"); setPayOpen(false); refresh(); }
    else { toast.error(r.error.message); }
  };

  const customerReceivable = customers.reduce((s, c) => s + Math.max(0, c.balance ?? 0), 0);
  const supplierPayable = suppliers.reduce((s, x) => s + Math.max(0, x.balance ?? 0), 0);

  const rows = tab === "customer"
    ? customers.filter((c) => (c.balance ?? 0) !== 0).sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
    : suppliers.filter((s) => (s.balance ?? 0) !== 0).sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Cari Hesaplar" description="Müşteri alacakları ve tedarikçi borçları" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Toplam Alacak (müşteriler)</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-emerald-600">{formatCurrency(customerReceivable)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Toplam Borç (tedarikçiler)</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-rose-600">{formatCurrency(supplierPayable)}</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="customer">Müşteriler (Alacak)</TabsTrigger>
          <TabsTrigger value="supplier">Tedarikçiler (Borç)</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">{[1, 2, 3].map((i) => (<div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />))}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={BookUser} title="Bakiyeli hesap yok" description="Veresiye satış veya açık hesap alış yapıldığında burada görünür." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tab === "customer" ? "Müşteri" : "Tedarikçi"}</TableHead>
                  <TableHead className="text-right">{tab === "customer" ? "Alacak" : "Borç"}</TableHead>
                  <TableHead className="text-center w-[220px]">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.name}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${tab === "customer" ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatCurrency(Math.abs(p.balance ?? 0))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openStatement(tab, p.id, p.name)}>
                          <FileText className="mr-1.5 h-3.5 w-3.5" />Ekstre
                        </Button>
                        <Button size="sm" onClick={() => openPay(p.id, p.name)}>
                          <Wallet className="mr-1.5 h-3.5 w-3.5" />{tab === "customer" ? "Tahsilat" : "Ödeme"}
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

      {/* Statement dialog */}
      <Dialog open={stmtOpen} onOpenChange={setStmtOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cari Ekstre — {stmtTitle}</DialogTitle>
            <DialogDescription>Borç / Alacak hareketleri</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="text-right">Borç</TableHead>
                  <TableHead className="text-right">Alacak</TableHead>
                  <TableHead className="text-right">Bakiye</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stmtRows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Hareket yok</TableCell></TableRow>
                ) : stmtRows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{row.date}</TableCell>
                    <TableCell className="text-xs">{row.description}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{row.debit ? formatCurrency(row.debit) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{row.credit ? formatCurrency(row.credit) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-medium">{formatCurrency(row.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setStmtOpen(false)}>Kapat</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{tab === "customer" ? "Tahsilat Al" : "Ödeme Yap"}</DialogTitle>
            <DialogDescription>{payParty?.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2"><Label>Tutar (₺) *</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" autoFocus /></div>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>İptal</Button>
            <Button onClick={handlePay}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
