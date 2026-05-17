"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, ShoppingCart, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import {
  getReorderSuggestions,
  createDraftPOFromSuggestions,
  getSuppliers,
  getWarehouses,
  type ReorderSuggestion,
} from "@/lib/actions";
import type { Supplier, Warehouse } from "@/lib/types";

interface RowState {
  selected: boolean;
  qty: number;
  unitPrice: number;
  supplierId?: string;
}

export default function ReorderPage() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getReorderSuggestions(), getSuppliers(), getWarehouses()]).then(
      ([r, s, w]) => {
        if (r.ok) {
          setSuggestions(r.data);
          const initial: Record<string, RowState> = {};
          for (const sug of r.data) {
            initial[sug.productId] = {
              selected: true,
              qty: sug.suggestedQty,
              unitPrice: sug.lastPurchasePrice,
              supplierId: sug.preferredSupplierId,
            };
          }
          setRowState(initial);
        }
        if (s.ok) setSuppliers(s.data);
        if (w.ok) {
          setWarehouses(w.data);
          if (w.data.length > 0) setWarehouseId(w.data[0].id);
        }
        setLoading(false);
      }
    );
  }, []);

  // Group rows by supplier for the action buttons.
  const groupedBySupplier = useMemo(() => {
    const groups = new Map<string, { supplier: Supplier | null; rows: ReorderSuggestion[] }>();
    for (const s of suggestions) {
      const state = rowState[s.productId];
      if (!state?.selected) continue;
      const supplierId = state.supplierId ?? "unassigned";
      const supplier = suppliers.find((sp) => sp.id === supplierId) ?? null;
      const existing = groups.get(supplierId) ?? { supplier, rows: [] };
      existing.rows.push(s);
      groups.set(supplierId, existing);
    }
    return Array.from(groups.entries());
  }, [suggestions, suppliers, rowState]);

  const createPO = async (supplierId: string, rows: ReorderSuggestion[]) => {
    if (!warehouseId) {
      toast.error("Önce depo seçin");
      return;
    }
    if (supplierId === "unassigned") {
      toast.error("Önce her ürüne tedarikçi atayın");
      return;
    }
    setSubmitting(true);
    const items = rows.map((r) => {
      const s = rowState[r.productId];
      return {
        productId: r.productId,
        qty: s.qty,
        unitPrice: s.unitPrice,
      };
    });
    const result = await createDraftPOFromSuggestions({ supplierId, warehouseId, items });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Draft sipariş oluşturuldu (${items.length} kalem)`);
    router.push("/dashboard/orders/purchase");
  };

  const updateRow = (id: string, patch: Partial<RowState>) => {
    setRowState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sipariş Önerileri"
        description={`Stoğu kritik seviyenin altında olan ${suggestions.length} ürün`}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Hedef Depo:</span>
            <Select value={warehouseId} onValueChange={(v) => v && setWarehouseId(v)}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Depo" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded bg-muted/50 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ) : suggestions.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={ShoppingCart}
              title="Sipariş önerisi yok"
              description="Tüm ürünler minimum stoğun üstünde."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Ürün</TableHead>
                    <TableHead className="text-right">Mevcut</TableHead>
                    <TableHead className="text-right">Min</TableHead>
                    <TableHead className="text-right">Eksik</TableHead>
                    <TableHead>Sipariş Adedi</TableHead>
                    <TableHead>Birim Fiyat</TableHead>
                    <TableHead>Tedarikçi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggestions.map((s) => {
                    const state = rowState[s.productId];
                    if (!state) return null;
                    return (
                      <TableRow key={s.productId} className={!state.selected ? "opacity-50" : ""}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={state.selected}
                            onChange={(e) => updateRow(s.productId, { selected: e.target.checked })}
                            className="size-4 accent-primary"
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{s.sku}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.currentStock}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{s.minStock}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive" className="text-[10px] tabular-nums">
                            {s.shortage}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateRow(s.productId, { qty: Math.max(1, state.qty - 1) })}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={state.qty}
                              onChange={(e) =>
                                updateRow(s.productId, { qty: Math.max(0, Number(e.target.value) || 0) })
                              }
                              className="h-7 w-16 text-center tabular-nums"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateRow(s.productId, { qty: state.qty + 1 })}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={state.unitPrice}
                            onChange={(e) =>
                              updateRow(s.productId, { unitPrice: Number(e.target.value) || 0 })
                            }
                            className="h-7 w-24 text-right tabular-nums"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={state.supplierId ?? ""}
                            onValueChange={(v) => updateRow(s.productId, { supplierId: typeof v === "string" ? v : undefined })}
                          >
                            <SelectTrigger className="h-7 w-[160px]">
                              <SelectValue placeholder="Tedarikçi…" />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map((sup) => (
                                <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Tedarikçi başına draft sipariş oluştur
              </div>
              <div className="space-y-2">
                {groupedBySupplier.map(([supplierId, group]) => {
                  const total = group.rows.reduce((sum, r) => {
                    const s = rowState[r.productId];
                    return sum + (s?.qty ?? 0) * (s?.unitPrice ?? 0);
                  }, 0);
                  return (
                    <div
                      key={supplierId}
                      className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {group.supplier?.name ?? "Tedarikçisiz"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {group.rows.length} kalem · Toplam: ₺{total.toFixed(2)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => createPO(supplierId, group.rows)}
                        disabled={submitting || supplierId === "unassigned"}
                      >
                        {submitting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="mr-2 h-3.5 w-3.5" />}
                        PO Oluştur
                      </Button>
                    </div>
                  );
                })}
                {groupedBySupplier.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Hiçbir ürün seçilmedi.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
