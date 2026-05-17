"use client";

import * as XLSX from "xlsx";
import type { ProductWithStock, Category } from "@/lib/types";

const HEADERS = [
  "name",
  "sku",
  "barcode",
  "category",
  "unit",
  "min_stock",
  "max_stock",
  "purchase_price",
  "sale_price",
  "description",
] as const;

const HEADER_LABELS: Record<(typeof HEADERS)[number], string> = {
  name: "Ürün Adı",
  sku: "SKU",
  barcode: "Barkod",
  category: "Kategori",
  unit: "Birim",
  min_stock: "Min Stok",
  max_stock: "Max Stok",
  purchase_price: "Alış Fiyatı",
  sale_price: "Satış Fiyatı",
  description: "Açıklama",
};

export interface ProductImportRow {
  rowNumber: number;
  name: string;
  sku: string;
  barcode?: string;
  categoryName?: string;
  unit: string;
  minStock: number;
  maxStock: number;
  purchasePrice: number;
  salePrice: number;
  description?: string;
}

export interface ProductImportError {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface ProductImportResult {
  rows: ProductImportRow[];
  errors: ProductImportError[];
}

/**
 * Build a fresh import template (blank rows + headers + Turkish examples).
 * Saved as .xlsx via SheetJS.
 */
export function downloadProductTemplate() {
  const headerRow = HEADERS.map((h) => HEADER_LABELS[h]);
  const example = [
    "Paracetamol 500mg",
    "ILC-001",
    "8690000000000",
    "İlaçlar",
    "kutu",
    50,
    500,
    12.5,
    18.9,
    "Ağrı kesici",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headerRow, example]);
  ws["!cols"] = HEADERS.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ürünler");
  XLSX.writeFile(wb, "urun_sablon.xlsx");
}

/**
 * Parse a user-uploaded xlsx/csv. Header row is matched case-insensitively
 * against both keys (`name`) and Turkish labels (`Ürün Adı`).
 */
export async function parseProductsFile(file: File): Promise<ProductImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  const rows: ProductImportRow[] = [];
  const errors: ProductImportError[] = [];

  raw.forEach((r, idx) => {
    const rowNumber = idx + 2; // header is row 1 in spreadsheets

    const lookup = (key: (typeof HEADERS)[number]): string => {
      const label = HEADER_LABELS[key];
      // Try multiple matchers
      const matches = Object.keys(r).filter(
        (k) =>
          k.toLowerCase().trim() === key.toLowerCase() ||
          k.toLowerCase().trim() === label.toLowerCase()
      );
      if (matches.length === 0) return "";
      const v = r[matches[0]];
      return v === null || v === undefined ? "" : String(v).trim();
    };

    const name = lookup("name");
    const sku = lookup("sku");

    if (!name && !sku) return; // skip fully-empty rows

    if (!name) errors.push({ rowNumber, field: "name", message: "Ürün adı boş" });
    if (!sku) errors.push({ rowNumber, field: "sku", message: "SKU boş" });

    const parseNum = (key: (typeof HEADERS)[number], required = false): number => {
      const raw = lookup(key);
      if (raw === "") {
        if (required) errors.push({ rowNumber, field: key, message: `${HEADER_LABELS[key]} boş` });
        return 0;
      }
      const cleaned = raw.replace(/,/g, ".").replace(/[^0-9.\-]/g, "");
      const n = Number(cleaned);
      if (Number.isNaN(n)) {
        errors.push({ rowNumber, field: key, message: `${HEADER_LABELS[key]} sayı değil: ${raw}` });
        return 0;
      }
      if (n < 0) errors.push({ rowNumber, field: key, message: `${HEADER_LABELS[key]} negatif olamaz` });
      return n;
    };

    rows.push({
      rowNumber,
      name,
      sku: sku.toUpperCase(),
      barcode: lookup("barcode") || undefined,
      categoryName: lookup("category") || undefined,
      unit: lookup("unit") || "adet",
      minStock: parseNum("min_stock"),
      maxStock: parseNum("max_stock"),
      purchasePrice: parseNum("purchase_price"),
      salePrice: parseNum("sale_price"),
      description: lookup("description") || undefined,
    });
  });

  // Dedupe: SKU must be unique within the file.
  const seenSku = new Set<string>();
  for (const r of rows) {
    if (seenSku.has(r.sku)) {
      errors.push({ rowNumber: r.rowNumber, field: "sku", message: `Tekrar eden SKU: ${r.sku}` });
    }
    seenSku.add(r.sku);
  }

  return { rows, errors };
}

/** Build a downloadable error report from a failed import. */
export function downloadImportErrorReport(errors: ProductImportError[]) {
  const data = [
    ["Satır", "Alan", "Hata"],
    ...errors.map((e) => [e.rowNumber, e.field ?? "—", e.message]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 8 }, { wch: 16 }, { wch: 60 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hatalar");
  XLSX.writeFile(wb, `urun_import_hatalari_${new Date().toISOString().split("T")[0]}.xlsx`);
}

// ============================================
// EXPORTS — full product list to xlsx
// ============================================

export function exportProductsXlsx(products: ProductWithStock[], categories: Category[]) {
  const headerRow = HEADERS.map((h) => HEADER_LABELS[h]);
  headerRow.push("Mevcut Stok", "Durum");
  const rows = products.map((p) => {
    const cat = categories.find((c) => c.id === p.categoryId);
    return [
      p.name,
      p.sku,
      p.barcode ?? "",
      cat?.name ?? "",
      p.unit,
      p.minStock,
      p.maxStock,
      p.purchasePrice,
      p.salePrice,
      p.description ?? "",
      p.currentStock,
      p.stockStatus,
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...rows]);
  ws["!cols"] = headerRow.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ürünler");
  XLSX.writeFile(wb, `urunler_${new Date().toISOString().split("T")[0]}.xlsx`);
}
