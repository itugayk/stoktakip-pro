"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, Download, AlertTriangle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/shared";
import {
  parseProductsFile,
  downloadProductTemplate,
  downloadImportErrorReport,
  type ProductImportRow,
  type ProductImportError,
} from "@/lib/xlsx/products";
import { bulkImportProducts } from "@/lib/actions";

export default function ImportProductsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ProductImportRow[]>([]);
  const [errors, setErrors] = useState<ProductImportError[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; errors: number } | null>(null);

  const handleFile = async (file: File) => {
    setParsing(true);
    setRows([]);
    setErrors([]);
    setResult(null);
    setFileName(file.name);
    try {
      const parsed = await parseProductsFile(file);
      setRows(parsed.rows);
      setErrors(parsed.errors);
      if (parsed.rows.length === 0) {
        toast.error("Dosyada okunabilir satır yok");
      } else {
        toast.success(`${parsed.rows.length} satır hazır${parsed.errors.length ? `, ${parsed.errors.length} hata` : ""}`);
      }
    } catch (e) {
      toast.error("Dosya okunamadı", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    const r = await bulkImportProducts({
      rows: rows.map((row) => ({
        name: row.name,
        sku: row.sku,
        barcode: row.barcode,
        categoryName: row.categoryName,
        unit: row.unit,
        minStock: row.minStock,
        maxStock: row.maxStock,
        purchasePrice: row.purchasePrice,
        salePrice: row.salePrice,
        description: row.description,
      })),
    });
    setImporting(false);
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    setResult({ created: r.data.created, updated: r.data.updated, errors: r.data.errors.length });
    toast.success(`${r.data.created} eklendi, ${r.data.updated} güncellendi`);
    if (r.data.errors.length > 0) {
      toast.warning(`${r.data.errors.length} satırda hata`, {
        description: "Hataları indir butonuna basın",
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Ürün İçe Aktarma"
        description="Excel / CSV dosyasından toplu ürün yükle"
        breadcrumb={[
          { label: "Ürünler", href: "/dashboard/products" },
          { label: "İçe Aktar" },
        ]}
        actions={
          <Button variant="outline" onClick={downloadProductTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Şablon İndir
          </Button>
        }
      />

      <Card>
        <CardContent className="p-6 space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-10 text-center cursor-pointer hover:bg-muted/50 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Dosya seçin veya buraya bırakın</p>
            <p className="text-xs text-muted-foreground">.xlsx · .xls · .csv</p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            {fileName && (
              <Badge variant="secondary" className="mt-2 text-xs">
                <FileSpreadsheet className="mr-1 h-3 w-3" />
                {fileName}
              </Badge>
            )}
          </label>
        </CardContent>
      </Card>

      {parsing && (
        <Card>
          <CardContent className="p-6 flex items-center gap-2 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Dosya okunuyor…
          </CardContent>
        </Card>
      )}

      {!parsing && rows.length > 0 && !result && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Toplam</p>
                <p className="text-2xl font-bold tabular-nums mt-1">{rows.length}</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
                <p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Geçerli</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-emerald-600">
                  {rows.length - new Set(errors.map((e) => e.rowNumber)).size}
                </p>
              </div>
              <div className="rounded-lg bg-rose-500/10 p-3 text-center">
                <p className="text-xs uppercase tracking-wider text-rose-700 dark:text-rose-300">Hatalı</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-rose-600">
                  {new Set(errors.map((e) => e.rowNumber)).size}
                </p>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="h-4 w-4" />
                  {errors.length} hata bulundu — geçerli satırlar yine de aktarılır
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadImportErrorReport(errors)}
                  className="-ml-2 h-7"
                >
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Hata raporunu indir
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => router.push("/dashboard/products")}>
                İptal
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {rows.length} satırı içe aktar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-500/10 mb-3">
              <Check className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="font-semibold">İçe aktarma tamam</p>
            <p className="text-sm text-muted-foreground mt-1">
              {result.created} eklendi · {result.updated} güncellendi
              {result.errors > 0 && ` · ${result.errors} hatalı`}
            </p>
            <Button className="mt-4" onClick={() => router.push("/dashboard/products")}>
              Ürünler sayfasına git
            </Button>
          </CardContent>
        </Card>
      )}

      {!parsing && rows.length === 0 && !result && fileName === "" && (
        <Card>
          <CardContent>
            <EmptyState
              icon={FileSpreadsheet}
              title="Henüz dosya seçilmedi"
              description="Şablonu indirin, doldurun ve buraya yükleyin."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
