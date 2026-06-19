"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Plus, Trash2, Wallet, Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import {
  getBusinessPnL, listExpenses, createExpense, deleteExpense,
} from "@/lib/actions";
import type { BusinessPnL, ExpenseRow } from "@/lib/actions";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
const formatPct = (n: number) => `${(n * 100).toFixed(1)}%`;

const methodLabel: Record<string, string> = {
  cash: "Nakit", card: "Kart", bank_transfer: "Havale", credit: "Veresiye", check: "Çek", other: "Diğer",
};
const categoryLabel: Record<string, string> = {
  rent: "Kira", salary: "Maaş", utilities: "Faturalar", logistics: "Lojistik", tax: "Vergi", other: "Diğer",
};

export default function PnLPage() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [pnl, setPnl] = useState<BusinessPnL | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [category, setCategory] = useState("other");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const run = () => {
    setLoading(true);
    Promise.all([getBusinessPnL({ from, to }), listExpenses({ from, to })]).then(([p, e]) => {
      if (p.ok) setPnl(p.data); else toast.error(p.error.message);
      if (e.ok) setExpenses(e.data);
      setLoading(false);
    });
  };

  useEffect(() => { run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleAddExpense = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) { toast.error("Geçerli tutar girin"); return; }
    const r = await createExpense({ category: category as never, amount: amt, description: description || undefined });
    if (r.ok) { toast.success("Gider eklendi"); setShowAdd(false); setAmount(""); setDescription(""); setCategory("other"); run(); }
    else { toast.error(r.error.message); }
  };

  const handleDeleteExpense = async (id: string) => {
    const r = await deleteExpense(id);
    if (r.ok) { toast.success("Silindi"); run(); } else { toast.error(r.error.message); }
  };

  const kpi = (label: string, value: string, accent?: string) => (
    <Card><CardContent className="p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${accent ?? ""}`}>{value}</p>
    </CardContent></Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="İşletme Kâr / Zarar"
        description="Dönem geneli ciro, maliyet, gider, net kâr ve cari durum"
        breadcrumb={[{ label: "Raporlar", href: "/dashboard/reports" }, { label: "Kâr/Zarar" }]}
      />

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="grid gap-1"><Label className="text-xs">Başlangıç</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="grid gap-1"><Label className="text-xs">Bitiş</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Button onClick={run} disabled={loading}><TrendingUp className="mr-2 h-4 w-4" />Çalıştır</Button>
        </CardContent>
      </Card>

      {pnl && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {kpi("Ciro (satış)", formatCurrency(pnl.revenue))}
            {kpi("Satılan Mal Maliyeti", formatCurrency(pnl.cogs), "text-muted-foreground")}
            {kpi("Brüt Kâr", formatCurrency(pnl.grossProfit), pnl.grossProfit < 0 ? "text-rose-500" : "text-emerald-500")}
            {kpi("Brüt Marj", formatPct(pnl.grossMarginPct))}
            {kpi("Toplam Alış", formatCurrency(pnl.purchases), "text-muted-foreground")}
            {kpi("Giderler", formatCurrency(pnl.expenses), "text-amber-500")}
            {kpi("Net Kâr", formatCurrency(pnl.netProfit), pnl.netProfit < 0 ? "text-rose-500" : "text-emerald-500")}
            {kpi("Alacak / Borç", `${formatCurrency(pnl.receivables)} / ${formatCurrency(pnl.payables)}`)}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Banknote className="h-4 w-4 text-emerald-500" />Tahsilat (nakit girişi)</CardTitle></CardHeader>
              <CardContent>
                {pnl.cashIn.length === 0 ? <p className="text-sm text-muted-foreground">Kayıt yok</p> : (
                  <div className="space-y-1">
                    {pnl.cashIn.map((c) => (
                      <div key={c.method} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{methodLabel[c.method] ?? c.method}</span>
                        <span className="tabular-nums font-medium">{formatCurrency(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4 text-rose-500" />Ödeme (nakit çıkışı)</CardTitle></CardHeader>
              <CardContent>
                {pnl.cashOut.length === 0 ? <p className="text-sm text-muted-foreground">Kayıt yok</p> : (
                  <div className="space-y-1">
                    {pnl.cashOut.map((c) => (
                      <div key={c.method} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{methodLabel[c.method] ?? c.method}</span>
                        <span className="tabular-nums font-medium">{formatCurrency(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Expenses */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Giderler</CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="mr-2 h-4 w-4" />Gider Ekle</Button>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <EmptyState title="Gider yok" description="Bu dönem için kira, maaş gibi işletme giderlerini ekleyin." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((e) => (
                  <TableRow key={e.id} className="group">
                    <TableCell className="text-xs">{e.expenseDate}</TableCell>
                    <TableCell className="text-sm">{categoryLabel[e.category] ?? e.category}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.description || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(e.amount)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100" onClick={() => handleDeleteExpense(e.id)}>
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
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Gider Ekle</DialogTitle><DialogDescription>İşletme gideri kaydı</DialogDescription></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={(v) => setCategory(v || "other")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Kira</SelectItem>
                  <SelectItem value="salary">Maaş</SelectItem>
                  <SelectItem value="utilities">Faturalar</SelectItem>
                  <SelectItem value="logistics">Lojistik</SelectItem>
                  <SelectItem value="tax">Vergi</SelectItem>
                  <SelectItem value="other">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Tutar (₺) *</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" /></div>
            <div className="grid gap-2"><Label>Açıklama</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>İptal</Button>
            <Button onClick={handleAddExpense}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
