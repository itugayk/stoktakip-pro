"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import nextDynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import {
  Plus, Package, MoreHorizontal,
  Edit, Trash2, Eye, Barcode,
  Download, Printer, FileSpreadsheet, Camera, CameraOff,
  Tag as TagIcon, PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { PageHeader, InlineEditCell, ConfirmDialog, FavoriteStar } from "@/components/shared";
import {
  DataTable,
  FilterBar,
  BulkToolbar,
  useTableState,
  type DataTableColumn,
} from "@/components/shared/data-table";
import {
  getProducts, getCategories, createProduct, updateProduct, deleteProduct,
  bulkUpdateProducts, bulkDeleteProducts, bulkPriceUpdate,
  getFavorites,
} from "@/lib/actions";
import { isClientDemoMode, mergeStoredDemoProducts, saveStoredDemoProduct } from "@/lib/demo-store";
import { UNITS } from "@/lib/types";
import type { ProductWithStock, Category } from "@/lib/types";
import type { ScannerResult } from "@/components/scanner/barcode-scanner";

const BarcodeScanner = nextDynamic(
  () => import("@/components/scanner/barcode-scanner").then((mod) => mod.BarcodeScanner),
  { ssr: false }
);

const STATUS_LABEL: Record<string, string> = {
  ok: "Normal",
  low: "Düşük",
  critical: "Kritik",
  overstock: "Fazla",
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(val);

const stockBadge = (status: string) => {
  switch (status) {
    case "critical":
      return <Badge variant="destructive" className="text-[10px]">Kritik</Badge>;
    case "low":
      return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]">Düşük</Badge>;
    case "overstock":
      return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px]">Fazla</Badge>;
    default:
      return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">Normal</Badge>;
  }
};

export function ProductsPageClient() {
  const t = useTranslations("products");
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithStock | null>(null);
  const [barcodeScannerActive, setBarcodeScannerActive] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [priceDialog, setPriceDialog] = useState<{ type: "percent" | "fixed"; value: string } | null>(null);

  const {
    state,
    setQuery,
    setPage,
    setPageSize,
    toggleSort,
    setFilter,
    toggleColumn,
  } = useTableState({
    storageKey: "products-table",
    defaultPageSize: 25,
    defaultSort: { id: "name", dir: "asc" },
    filterKeys: ["category", "status"],
  });

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const [p, c, f] = await Promise.all([
          getProducts(undefined),
          getCategories(),
          getFavorites("product"),
        ]);
        if (p.ok) setProducts(mergeStoredDemoProducts(p.data));
        if (c.ok) setCategories(c.data);
        if (f.ok) setFavorites(new Set(f.data.map((x) => x.entityId)));
        if (!p.ok || !c.ok) toast.error("Ürünler yüklenemedi");
      } catch (err) {
        console.error("Products load error:", err);
        toast.error("Ürünler yüklenemedi");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Apply filters + sort client-side. (Server-side pagination is the future
  // migration once row counts grow; the API surface is ready for it.)
  const filtered = useMemo(() => {
    let result = [...products];
    const q = state.query.toLowerCase();
    if (q) {
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.includes(q)
      );
    }
    if (state.filters.category) {
      result = result.filter((p) => p.categoryId === state.filters.category);
    }
    if (state.filters.status) {
      result = result.filter((p) => p.stockStatus === state.filters.status);
    }
    if (state.sort) {
      const { id, dir } = state.sort;
      result.sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[id] ?? "";
        const bv = (b as unknown as Record<string, unknown>)[id] ?? "";
        const cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "tr", { numeric: true });
        return dir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [products, state.query, state.filters, state.sort]);

  const pageRows = useMemo(() => {
    const start = (state.page - 1) * state.pageSize;
    return filtered.slice(start, start + state.pageSize);
  }, [filtered, state.page, state.pageSize]);

  // ========== inline edit handler ==========
  const inlineSave = useCallback(
    async (id: string, patch: Partial<ProductWithStock>) => {
      const result = await updateProduct({ id, patch });
      if (!result.ok) {
        toast.error(result.error.message);
        throw new Error(result.error.message);
      }
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    []
  );

  // ========== EDIT (modal) ==========
  const [editForm, setEditForm] = useState({
    name: "", sku: "", barcode: "", categoryId: "", unit: "adet",
    minStock: "", maxStock: "", purchasePrice: "", salePrice: "", description: "",
  });

  const openEditDialog = (product: ProductWithStock) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || "",
      categoryId: product.categoryId || categories[0]?.id || "cat-1",
      unit: product.unit,
      minStock: String(product.minStock),
      maxStock: String(product.maxStock),
      purchasePrice: String(product.purchasePrice),
      salePrice: String(product.salePrice),
      description: product.description || "",
    });
    setShowEditDialog(true);
  };

  const handleEditProduct = async () => {
    if (!editingProduct || !editForm.name || !editForm.sku) {
      toast.error("Ürün adı ve SKU zorunludur"); return;
    }
    const result = await updateProduct({
      id: editingProduct.id,
      patch: {
        name: editForm.name,
        sku: editForm.sku,
        barcode: editForm.barcode || undefined,
        categoryId: editForm.categoryId,
        unit: editForm.unit,
        minStock: parseInt(editForm.minStock) || 10,
        maxStock: parseInt(editForm.maxStock) || 100,
        purchasePrice: parseFloat(editForm.purchasePrice) || 0,
        salePrice: parseFloat(editForm.salePrice) || 0,
        description: editForm.description || undefined,
      },
    });

    if (result.ok) {
      const cat = categories.find((c) => c.id === editForm.categoryId);
      setProducts((prev) => prev.map((p) => {
        if (p.id !== editingProduct.id) return p;
        return {
          ...p,
          name: editForm.name,
          sku: editForm.sku,
          barcode: editForm.barcode || undefined,
          categoryId: editForm.categoryId,
          categoryName: cat?.name || p.categoryName,
          unit: editForm.unit,
          minStock: parseInt(editForm.minStock) || 10,
          maxStock: parseInt(editForm.maxStock) || 100,
          purchasePrice: parseFloat(editForm.purchasePrice) || 0,
          salePrice: parseFloat(editForm.salePrice) || 0,
          description: editForm.description || undefined,
        };
      }));
      setShowEditDialog(false);
      setEditingProduct(null);
      toast.success("Ürün güncellendi");
    } else {
      toast.error(result.error.message);
    }
  };

  // ========== DELETE ==========
  const handleDelete = async (id: string) => {
    const result = await deleteProduct(id);
    if (result.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Ürün silindi");
    } else {
      toast.error(result.error.message);
    }
  };

  // ========== CSV EXPORT ==========
  const exportCSV = useCallback(() => {
    const headers = ["Ad", "SKU", "Barkod", "Kategori", "Stok", "Birim", "Alış", "Satış", "Durum"];
    const rows = filtered.map((p) => [
      p.name, p.sku, p.barcode ?? "", p.categoryName, p.currentStock, p.unit,
      p.purchasePrice, p.salePrice, p.stockStatus,
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `urunler_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV indirildi");
  }, [filtered]);

  // ========== BARCODE LABEL PRINT ==========
  const printBarcodeLabel = useCallback((product: ProductWithStock) => {
    const printWindow = window.open("", "_blank", "width=400,height=300");
    if (!printWindow) { toast.error("Popup engelleyici aktif"); return; }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barkod Etiket — ${product.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
          .label { width: 280px; padding: 16px; border: 2px dashed #ccc; text-align: center; }
          .name { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
          .barcode { font-family: 'Libre Barcode 128', monospace; font-size: 56px; letter-spacing: 2px; margin: 8px 0; }
          .code { font-family: monospace; font-size: 12px; color: #666; margin-bottom: 4px; }
          .price { font-size: 18px; font-weight: 700; margin-top: 6px; }
          .sku { font-size: 10px; color: #999; }
          @media print { .label { border: none; } }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
      </head>
      <body>
        <div class="label">
          <div class="name">${product.name}</div>
          <div class="barcode">${product.barcode || product.sku}</div>
          <div class="code">${product.barcode || "—"}</div>
          <div class="sku">SKU: ${product.sku}</div>
          <div class="price">${formatCurrency(product.salePrice)}</div>
        </div>
        <script>
          document.fonts.ready.then(() => { setTimeout(() => window.print(), 300); });
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    toast.success("Barkod etiketi yazdırılıyor");
  }, []);

  // ========== ADD PRODUCT ==========
  const [newProduct, setNewProduct] = useState({
    name: "", sku: "", barcode: "", categoryId: categories[0]?.id || "cat-1", unit: "adet",
    minStock: "10", maxStock: "100", purchasePrice: "", salePrice: "", description: "",
  });

  const handleAddDialogOpenChange = (open: boolean) => {
    setShowAddDialog(open);
    if (!open) {
      setBarcodeScannerActive(false);
    }
  };

  const toggleBarcodeScanner = () => {
    if (barcodeScannerActive) {
      setBarcodeScannerActive(false);
      return;
    }

    if (!window.isSecureContext) {
      toast.error("Kamera için HTTPS gerekli", {
        description: "Telefonda tünel HTTPS adresini veya HTTPS LAN adresini açın.",
      });
      return;
    }

    setBarcodeScannerActive(true);
  };

  const handleBarcodeScan = useCallback((result: ScannerResult) => {
    const barcode = result.text.trim();
    if (!barcode) return;

    setNewProduct((prev) => ({ ...prev, barcode }));
    setBarcodeScannerActive(false);

    const duplicate = products.find((product) => product.barcode === barcode);
    if (duplicate) {
      toast.warning("Bu barkod zaten kayıtlı", {
        description: `${duplicate.name} (${duplicate.sku})`,
      });
      return;
    }

    toast.success("Barkod forma eklendi", {
      description: barcode,
    });
  }, [products]);

  const handleBarcodeError = useCallback((error: string) => {
    toast.error("Barkod tarama hatası", { description: error });
    setBarcodeScannerActive(false);
  }, []);

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.sku) {
      toast.error("Ürün adı ve SKU zorunludur"); return;
    }
    const result = await createProduct({
      name: newProduct.name,
      sku: newProduct.sku,
      barcode: newProduct.barcode || undefined,
      categoryId: newProduct.categoryId,
      unit: newProduct.unit,
      minStock: parseInt(newProduct.minStock) || 10,
      maxStock: parseInt(newProduct.maxStock) || 100,
      purchasePrice: parseFloat(newProduct.purchasePrice) || 0,
      salePrice: parseFloat(newProduct.salePrice) || 0,
      description: newProduct.description || undefined,
    });

    if (result.ok) {
      const cat = categories.find((c) => c.id === newProduct.categoryId);
      const addedProduct: ProductWithStock = {
        id: `prod-${Date.now()}`, name: newProduct.name, sku: newProduct.sku,
        barcode: newProduct.barcode || undefined, description: newProduct.description || undefined,
        categoryId: newProduct.categoryId, unit: newProduct.unit,
        minStock: parseInt(newProduct.minStock) || 10, maxStock: parseInt(newProduct.maxStock) || 100,
        purchasePrice: parseFloat(newProduct.purchasePrice) || 0, salePrice: parseFloat(newProduct.salePrice) || 0,
        isActive: true, createdAt: new Date().toISOString().split("T")[0], updatedAt: new Date().toISOString().split("T")[0],
        currentStock: 0, categoryName: cat?.name || "", stockStatus: "critical" as const,
      };

      if (isClientDemoMode()) {
        saveStoredDemoProduct(addedProduct);
      }

      setProducts((prev) => [addedProduct, ...prev]);
      setShowAddDialog(false);
      setBarcodeScannerActive(false);
      setNewProduct({ name: "", sku: "", barcode: "", categoryId: categories[0]?.id || "cat-1", unit: "adet", minStock: "10", maxStock: "100", purchasePrice: "", salePrice: "", description: "" });
      toast.success("Ürün başarıyla eklendi");
    } else {
      toast.error(result.error.message);
    }
  };

  // ========== BULK ACTIONS (1.5) ==========
  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      if (pageRows.every((r) => prev.has(r.id))) {
        const next = new Set(prev);
        pageRows.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      pageRows.forEach((r) => next.add(r.id));
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    const result = await bulkDeleteProducts({ ids });
    if (result.ok) {
      setProducts((prev) => prev.filter((p) => !selected.has(p.id)));
      clearSelection();
      toast.success(`${result.data.deleted} ürün silindi`);
    } else {
      toast.error(result.error.message);
    }
  };
  const handleBulkSetActive = async (isActive: boolean) => {
    const ids = Array.from(selected);
    const result = await bulkUpdateProducts({ ids, patch: { isActive } });
    if (result.ok) {
      setProducts((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, isActive } : p)));
      toast.success(`${result.data.updated} ürün ${isActive ? "aktifleştirildi" : "pasifleştirildi"}`);
      clearSelection();
    } else {
      toast.error(result.error.message);
    }
  };
  const handleBulkSetCategory = async (categoryId: string) => {
    const ids = Array.from(selected);
    const result = await bulkUpdateProducts({ ids, patch: { categoryId } });
    if (result.ok) {
      const cat = categories.find((c) => c.id === categoryId);
      setProducts((prev) =>
        prev.map((p) =>
          selected.has(p.id)
            ? { ...p, categoryId, categoryName: cat?.name || p.categoryName }
            : p
        )
      );
      toast.success(`${result.data.updated} ürünün kategorisi güncellendi`);
      clearSelection();
    } else {
      toast.error(result.error.message);
    }
  };
  const handleBulkPriceUpdate = async () => {
    if (!priceDialog) return;
    const value = parseFloat(priceDialog.value);
    if (isNaN(value)) {
      toast.error("Geçerli bir sayı girin");
      return;
    }
    const ids = Array.from(selected);
    const result = await bulkPriceUpdate({ ids, op: { type: priceDialog.type, value } });
    if (result.ok) {
      // Re-fetch to get authoritative prices (the operation may round).
      const fresh = await getProducts(undefined);
      if (fresh.ok) setProducts(mergeStoredDemoProducts(fresh.data));
      toast.success(`${result.data.updated} ürünün fiyatı güncellendi`);
      clearSelection();
      setPriceDialog(null);
    } else {
      toast.error(result.error.message);
    }
  };

  // ========== TABLE COLUMNS ==========
  const columns: DataTableColumn<ProductWithStock>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Ürün",
        sortable: true,
        cell: (p) => {
          const cat = categories.find((c) => c.id === p.categoryId);
          return (
            <div className="flex items-center gap-3">
              <FavoriteStar
                entityType="product"
                entityId={p.id}
                initial={favorites.has(p.id)}
              />
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm shrink-0">
                {cat?.icon || "📦"}
              </div>
              <div className="min-w-0">
                <InlineEditCell
                  value={p.name}
                  onSave={(v) => inlineSave(p.id, { name: String(v) })}
                  className="font-medium text-sm"
                />
                {p.barcode && (
                  <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 px-1">
                    <Barcode className="h-3 w-3" />
                    {p.barcode}
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "sku",
        header: "SKU",
        accessor: (p) => p.sku,
        cell: (p) => <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>,
        sortable: true,
      },
      {
        id: "categoryName",
        header: "Kategori",
        accessor: (p) => p.categoryName,
        cell: (p) => (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {p.categoryName}
          </Badge>
        ),
      },
      {
        id: "currentStock",
        header: "Stok",
        accessor: (p) => p.currentStock,
        sortable: true,
        className: "text-right",
        cell: (p) => (
          <span className="text-right font-semibold tabular-nums">
            {p.currentStock}{" "}
            <span className="text-xs font-normal text-muted-foreground">{p.unit}</span>
          </span>
        ),
      },
      {
        id: "minStock",
        header: "Min",
        accessor: (p) => p.minStock,
        sortable: true,
        className: "text-right",
        hiddenByDefault: false,
        cell: (p) => (
          <InlineEditCell
            value={p.minStock}
            type="number"
            inputMode="numeric"
            min={0}
            onSave={(v) => inlineSave(p.id, { minStock: Number(v) })}
            className="text-right tabular-nums"
          />
        ),
      },
      {
        id: "maxStock",
        header: "Max",
        accessor: (p) => p.maxStock,
        sortable: true,
        className: "text-right",
        cell: (p) => (
          <InlineEditCell
            value={p.maxStock}
            type="number"
            inputMode="numeric"
            min={0}
            onSave={(v) => inlineSave(p.id, { maxStock: Number(v) })}
            className="text-right tabular-nums"
          />
        ),
      },
      {
        id: "purchasePrice",
        header: "Alış",
        accessor: (p) => p.purchasePrice,
        sortable: true,
        className: "text-right",
        cell: (p) => (
          <span className="text-right text-sm tabular-nums">{formatCurrency(p.purchasePrice)}</span>
        ),
      },
      {
        id: "salePrice",
        header: "Satış",
        accessor: (p) => p.salePrice,
        sortable: true,
        className: "text-right",
        cell: (p) => (
          <InlineEditCell
            value={p.salePrice}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            onSave={(v) => inlineSave(p.id, { salePrice: Number(v) })}
            display={(v) => formatCurrency(v as number)}
            className="text-right tabular-nums"
          />
        ),
      },
      {
        id: "stockStatus",
        header: "Durum",
        accessor: (p) => p.stockStatus,
        className: "text-center",
        cell: (p) => stockBadge(p.stockStatus),
      },
      {
        id: "actions",
        header: "",
        className: "w-[60px]",
        cell: (p) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />Görüntüle</DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEditDialog(p)}>
                <Edit className="mr-2 h-4 w-4" />Düzenle
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => printBarcodeLabel(p)}>
                <Printer className="mr-2 h-4 w-4" />Barkod Yazdır
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(p.id)}>
                <Trash2 className="mr-2 h-4 w-4" />Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [categories, favorites, inlineSave, printBarcodeLabel]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t("title")}
        description={`${filtered.length} ürün listeleniyor`}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Dışa Aktar</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={exportCSV}><FileSpreadsheet className="mr-2 h-4 w-4" />CSV İndir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setShowAddDialog(true)} id="add-product-btn">
              <Plus className="mr-2 h-4 w-4" />{t("addProduct")}
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={pageRows}
        total={filtered.length}
        loading={loading}
        getRowId={(p) => p.id}
        hiddenCols={state.hiddenCols}
        sort={state.sort}
        onToggleSort={toggleSort}
        onToggleColumn={toggleColumn}
        page={state.page}
        pageSize={state.pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        emptyTitle="Ürün bulunamadı"
        emptyDescription={state.query ? "Arama veya filtreyi temizleyin." : "İlk ürünü ekleyerek başlayın."}
        toolbar={
          <FilterBar
            query={state.query}
            onQueryChange={setQuery}
            searchPlaceholder="Ürün adı, SKU veya barkod ara…"
            values={state.filters}
            onFilterChange={setFilter}
            filters={[
              {
                key: "category",
                label: "Kategori",
                options: categories.map((c) => ({ value: c.id, label: `${c.icon ?? ""} ${c.name}`.trim() })),
              },
              {
                key: "status",
                label: "Durum",
                options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
              },
            ]}
          />
        }
        selection={{
          selected,
          onToggleRow: toggleRow,
          onToggleAll: toggleAll,
        }}
        bulkBar={
          <BulkToolbar
            selectedCount={selected.size}
            onClear={clearSelection}
            actions={
              <>
                <Select onValueChange={(v) => { if (typeof v === "string" && v) handleBulkSetCategory(v); }}>
                  <SelectTrigger className="h-8 w-[180px]">
                    <TagIcon className="mr-1 h-3.5 w-3.5" />
                    <SelectValue placeholder="Kategori değiştir" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setPriceDialog({ type: "percent", value: "" })}>
                  Fiyat %
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPriceDialog({ type: "fixed", value: "" })}>
                  Fiyat ±₺
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkSetActive(false)}>
                  <PowerOff className="mr-1 h-3.5 w-3.5" />
                  Pasifleştir
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setConfirmBulkDelete(true)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Sil
                </Button>
              </>
            }
          />
        }
      />

      {/* Add Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={handleAddDialogOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("addProduct")}</DialogTitle>
            <DialogDescription>Yeni bir ürün kartı oluşturun</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t("productName")} *</Label>
              <Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Ürün adı" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("sku")} *</Label>
                <Input value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value.toUpperCase() })} placeholder="SKU-001" className="font-mono" />
              </div>
              <div className="grid gap-2">
                <Label>{t("barcode")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={newProduct.barcode}
                    onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                    placeholder="8690000000000"
                    className="font-mono flex-1"
                    inputMode="numeric"
                  />
                  <Button
                    type="button"
                    variant={barcodeScannerActive ? "default" : "outline"}
                    size="icon"
                    onClick={toggleBarcodeScanner}
                    aria-label={barcodeScannerActive ? "Kamerayı kapat" : "Kamerayı aç"}
                  >
                    {barcodeScannerActive ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            {barcodeScannerActive && (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <BarcodeScanner
                  onScan={handleBarcodeScan}
                  onError={handleBarcodeError}
                  active={barcodeScannerActive}
                />
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Kategori</Label>
                <Select value={newProduct.categoryId} onValueChange={(v) => setNewProduct({ ...newProduct, categoryId: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Birim</Label>
                <Select value={newProduct.unit} onValueChange={(v) => setNewProduct({ ...newProduct, unit: v ?? "adet" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (<SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Min. Stok</Label>
                <Input type="number" inputMode="numeric" value={newProduct.minStock} onChange={(e) => setNewProduct({ ...newProduct, minStock: e.target.value })} className="tabular-nums" />
              </div>
              <div className="grid gap-2">
                <Label>Max. Stok</Label>
                <Input type="number" inputMode="numeric" value={newProduct.maxStock} onChange={(e) => setNewProduct({ ...newProduct, maxStock: e.target.value })} className="tabular-nums" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Alış Fiyatı (₺)</Label>
                <Input type="number" inputMode="decimal" value={newProduct.purchasePrice} onChange={(e) => setNewProduct({ ...newProduct, purchasePrice: e.target.value })} className="tabular-nums" />
              </div>
              <div className="grid gap-2">
                <Label>Satış Fiyatı (₺)</Label>
                <Input type="number" inputMode="decimal" value={newProduct.salePrice} onChange={(e) => setNewProduct({ ...newProduct, salePrice: e.target.value })} className="tabular-nums" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleAddDialogOpenChange(false)}>İptal</Button>
            <Button onClick={handleAddProduct}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ürünü Düzenle</DialogTitle>
            <DialogDescription>Ürün bilgilerini güncelleyin</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Ürün Adı *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>SKU *</Label>
                <Input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value.toUpperCase() })} className="font-mono" />
              </div>
              <div className="grid gap-2">
                <Label>Barkod</Label>
                <Input value={editForm.barcode} onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })} className="font-mono" inputMode="numeric" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Kategori</Label>
                <Select value={editForm.categoryId} onValueChange={(v) => setEditForm({ ...editForm, categoryId: v ?? "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Birim</Label>
                <Select value={editForm.unit} onValueChange={(v) => setEditForm({ ...editForm, unit: v ?? "adet" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (<SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Min. Stok</Label>
                <Input type="number" inputMode="numeric" value={editForm.minStock} onChange={(e) => setEditForm({ ...editForm, minStock: e.target.value })} className="tabular-nums" />
              </div>
              <div className="grid gap-2">
                <Label>Max. Stok</Label>
                <Input type="number" inputMode="numeric" value={editForm.maxStock} onChange={(e) => setEditForm({ ...editForm, maxStock: e.target.value })} className="tabular-nums" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Alış (₺)</Label>
                <Input type="number" inputMode="decimal" value={editForm.purchasePrice} onChange={(e) => setEditForm({ ...editForm, purchasePrice: e.target.value })} className="tabular-nums" />
              </div>
              <div className="grid gap-2">
                <Label>Satış (₺)</Label>
                <Input type="number" inputMode="decimal" value={editForm.salePrice} onChange={(e) => setEditForm({ ...editForm, salePrice: e.target.value })} className="tabular-nums" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>İptal</Button>
            <Button onClick={handleEditProduct}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk price update dialog */}
      <Dialog open={!!priceDialog} onOpenChange={(o) => !o && setPriceDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Toplu Fiyat Güncelle</DialogTitle>
            <DialogDescription>
              Seçili {selected.size} ürünün satış fiyatını {priceDialog?.type === "percent" ? "yüzde olarak" : "sabit miktar ekleyerek"} güncelle.
            </DialogDescription>
          </DialogHeader>
          {priceDialog && (
            <div className="grid gap-3 py-2">
              <Label>
                {priceDialog.type === "percent" ? "Yüzde (-10 = %10 indirim)" : "Tutar (₺, negatif olabilir)"}
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={priceDialog.value}
                onChange={(e) => setPriceDialog({ ...priceDialog, value: e.target.value })}
                autoFocus
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriceDialog(null)}>İptal</Button>
            <Button onClick={handleBulkPriceUpdate}>Uygula</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
        title={`${selected.size} ürün silinsin mi?`}
        description="Bu işlem geri alınamaz."
        variant="destructive"
        confirmLabel="Sil"
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
