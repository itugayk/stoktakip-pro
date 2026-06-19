"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ScanLine, Camera, Keyboard, History,
  Volume2, VolumeX, CheckCircle2, XCircle, ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { demoProducts } from "@/lib/demo-data";
import { getProducts } from "@/lib/actions";
import { mergeStoredDemoProducts } from "@/lib/demo-store";
import type { ProductWithStock } from "@/lib/types";
import { PageHeader } from "@/components/shared";
import { pushRecentProduct } from "@/lib/recent";
import { feedback, setFeedbackEnabled } from "@/lib/feedback";
import { scanDetector } from "@/lib/scan-detector";
import { CameraScanOverlay, type ScanResultInfo } from "@/components/scanner/camera-scan-overlay";

function getScannerSecurity() {
  if (typeof window === "undefined") {
    return { isSecureOrigin: true, secureScannerUrl: null as string | null };
  }
  if (window.isSecureContext) {
    return { isSecureOrigin: true, secureScannerUrl: null as string | null };
  }
  const secureUrl = new URL(window.location.href);
  secureUrl.protocol = "https:";
  return { isSecureOrigin: false, secureScannerUrl: secureUrl.toString() };
}

interface ScanHistoryEntry {
  code: string;
  format?: string;
  product?: { name: string; sku: string; currentStock: number; unit: string };
  time: string;
  found: boolean;
}

interface BatchEntry {
  code: string;
  productId?: string;
  name: string;
  sku?: string;
  count: number;
  found: boolean;
}

export default function ScannerPage() {
  const [manualCode, setManualCode] = useState("");
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [batchMode, setBatchMode] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [{ isSecureOrigin, secureScannerUrl }] = useState(getScannerSecurity);
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [batchItems, setBatchItems] = useState<BatchEntry[]>([]);
  const [lastResult, setLastResult] = useState<ScanResultInfo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      try {
        const result = await getProducts(undefined);
        if (!cancelled) setProducts(mergeStoredDemoProducts(result.ok ? result.data : demoProducts));
      } catch {
        if (!cancelled) setProducts(mergeStoredDemoProducts(demoProducts));
      }
    }
    void loadProducts();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setFeedbackEnabled(soundEnabled);
  }, [soundEnabled]);

  const processCode = useCallback((code: string, format?: string) => {
    const normalizedCode = code.trim();
    if (!normalizedCode) return;

    const product = products.find(
      (p) => p.barcode === normalizedCode || p.sku === normalizedCode.toUpperCase()
    );

    const entry: ScanHistoryEntry = {
      code: normalizedCode,
      format,
      product: product
        ? { name: product.name, sku: product.sku, currentStock: product.currentStock, unit: product.unit }
        : undefined,
      time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      found: !!product,
    };

    setScanHistory((prev) => [entry, ...prev].slice(0, 100));
    setScanCount((c) => c + 1);

    // Feed the on-screen scan-overlay result sheet (unique seq re-triggers the flash).
    setLastResult({
      seq: Date.now(),
      found: !!product,
      title: product ? product.name : "Ürün bulunamadı",
      subtitle: product
        ? `SKU: ${product.sku} • Stok: ${product.currentStock} ${product.unit}`
        : format,
      code: normalizedCode,
    });

    if (product) {
      pushRecentProduct({ id: product.id, name: product.name, sku: product.sku });
    }

    if (batchMode) {
      setBatchItems((prev) => {
        const existing = prev.findIndex((b) => b.code === normalizedCode);
        if (existing >= 0) {
          feedback.warn();
          const next = [...prev];
          next[existing] = { ...next[existing], count: next[existing].count + 1 };
          return next;
        }
        feedback.ok();
        return [
          { code: normalizedCode, productId: product?.id, name: product?.name ?? "Bilinmeyen", sku: product?.sku, count: 1, found: !!product },
          ...prev,
        ];
      });
    } else if (product) {
      feedback.ok();
      if (!cameraActive) {
        toast.success(product.name, {
          description: `SKU: ${product.sku} • Stok: ${product.currentStock} ${product.unit}`,
          duration: 2000,
        });
      }
    } else {
      feedback.error();
      if (!cameraActive) {
        toast.error("Ürün bulunamadı", {
          description: `Kod: ${normalizedCode}${format ? ` (${format})` : ""}`,
          duration: 2000,
        });
      }
    }

    setManualCode("");
  }, [batchMode, products, cameraActive]);

  // HID (USB/Bluetooth) scanner detection — page-wide.
  useEffect(() => {
    return scanDetector.start({ onScan: (code) => processCode(code) });
  }, [processCode]);

  const handleCameraError = useCallback((error: string) => {
    toast.error("Kamera hatası", { description: error });
    setCameraActive(false);
  }, []);

  const openCamera = () => {
    if (!isSecureOrigin) {
      toast.error("Telefonda kamera için HTTPS gerekli", {
        description: "LAN adresini HTTPS modunda açmadan mobil tarayıcı kamera izni vermez.",
      });
      return;
    }
    setLastResult(null);
    setCameraActive(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") processCode(manualCode);
  };

  const clearHistory = () => {
    setScanHistory([]);
    setScanCount(0);
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <PageHeader
        title="Barkod / QR Tarayıcı"
        description="Kamera, harici okuyucu veya manuel giriş ile tarayın"
        actions={
          <>
            {scanCount > 0 && <Badge variant="secondary" className="text-xs">{scanCount} tarama</Badge>}
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? "Sesi kapat" : "Sesi aç"}>
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </>
        }
      />

      <Tabs defaultValue="camera" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3 md:h-8 md:max-w-md">
          <TabsTrigger value="camera" className="min-w-0 px-1 text-xs sm:text-sm">
            <Camera className="mr-1 h-4 w-4" /><span className="truncate">Kamera</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="min-w-0 px-1 text-xs sm:text-sm">
            <Keyboard className="mr-1 h-4 w-4" /><span className="truncate">Okuyucu</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="min-w-0 px-1 text-xs sm:text-sm">
            <History className="mr-1 h-4 w-4" /><span className="truncate">Geçmiş</span>
            {scanHistory.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">{scanHistory.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Camera Tab — launch screen for the full-screen scanner */}
        <TabsContent value="camera" className="mt-4">
          <Card className="overflow-hidden">
            <CardContent className="p-5 md:p-8">
              <div className="mx-auto flex max-w-md flex-col items-center gap-5 text-center">
                {!isSecureOrigin && (
                  <div className="flex w-full items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Telefonda kamera için HTTPS gerekli</p>
                      <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
                        Mobil tarayıcılar LAN üzerindeki HTTP adreslerinde kamera izni vermez. Güvenli (HTTPS) adresi kullanın.
                      </p>
                      {secureScannerUrl && (
                        <a href={secureScannerUrl} className="block break-all text-xs font-medium text-amber-900 underline underline-offset-4 dark:text-amber-100">
                          {secureScannerUrl}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="relative flex h-28 w-28 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-xl shadow-primary/30">
                    <ScanLine className="h-11 w-11" />
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Kamera ile Tara</h3>
                  <p className="text-sm text-muted-foreground">
                    Tam ekran tarayıcı açılır. Barkodu çerçeveye hizalayın — okuma otomatik yapılır ve sesle bildirilir.
                  </p>
                </div>

                <Button size="lg" className="h-12 w-full" onClick={openCamera} disabled={!isSecureOrigin}>
                  <Camera className="mr-2 h-5 w-5" />Kamerayı Başlat
                </Button>

                <div className="flex flex-wrap justify-center gap-1">
                  {["QR Code", "EAN-13", "EAN-8", "UPC-A", "Code-128", "Code-39", "DataMatrix"].map((f) => (
                    <Badge key={f} variant="outline" className="text-[10px] font-normal">{f}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accumulated batch list (visible after closing the camera) */}
          {batchItems.length > 0 && (
            <Card className="mt-4">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <p className="text-sm font-semibold">
                  {batchItems.length} farklı, {batchItems.reduce((s, b) => s + b.count, 0)} toplam okuma
                </p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setBatchItems([])}>Temizle</Button>
                  <Button size="sm" onClick={() => {
                    const lines = batchItems.map((b) => `${b.sku ?? b.code}\t${b.count}\t${b.name}`).join("\n");
                    navigator.clipboard.writeText(lines).then(() => toast.success("Liste panoya kopyalandı"));
                  }}>Topla işle</Button>
                </div>
              </div>
              <div className="max-h-72 divide-y divide-border overflow-y-auto">
                {batchItems.map((b) => (
                  <div key={b.code} className="flex items-center gap-3 px-4 py-2">
                    {b.found ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0 text-rose-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{b.sku ?? b.code}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs tabular-nums">×{b.count}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Manual / Hardware Scanner Tab */}
        <TabsContent value="manual" className="mt-4">
          <Card>
            <CardContent className="p-6">
              <div className="max-w-md mx-auto space-y-5">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <ScanLine className="h-8 w-8 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Harici Okuyucu Modu</p>
                    <p className="text-xs text-muted-foreground">
                      USB veya Bluetooth barkod okuyucu bağlıysa aşağıdaki alana odaklanın ve ürünü tarayın. Okuyucu otomatik Enter gönderir.
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Barkod veya SKU girin / tarayın..."
                    className="pl-11 h-14 text-lg font-mono focus:ring-2 focus:ring-primary/30"
                    id="scanner-input"
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <Button onClick={() => processCode(manualCode)} className="w-full h-12" disabled={!manualCode.trim()}>
                  <ScanLine className="mr-2 h-4 w-4" />Ara
                </Button>
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground font-medium">Hızlı test barkodları:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {products.filter((p) => p.barcode).slice(0, 6).map((p) => (
                      <Button key={p.id} variant="outline" size="sm" className="text-xs font-mono justify-start h-auto py-2" onClick={() => processCode(p.barcode!)}>
                        <div className="flex flex-col items-start">
                          <span className="text-[10px] text-muted-foreground font-sans">{p.name}</span>
                          <span>{p.barcode}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />Tarama Geçmişi
              </CardTitle>
              {scanHistory.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={clearHistory}>Temizle</Button>
              )}
            </CardHeader>
            <CardContent>
              {scanHistory.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground">
                  <ScanLine className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">Henüz tarama yapılmadı</p>
                  <p className="text-xs mt-1">Kamera veya okuyucu ile barkod tarayın</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {scanHistory.map((h, i) => (
                    <div key={`${h.code}-${h.time}-${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${h.found ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                        {h.found ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{h.product?.name || "Ürün bulunamadı"}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{h.code}</span>
                          {h.format && <Badge variant="outline" className="text-[9px] font-normal px-1 py-0">{h.format}</Badge>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {h.product && (
                          <p className="text-sm font-semibold tabular-nums">
                            {h.product.currentStock} <span className="text-xs font-normal text-muted-foreground">{h.product.unit}</span>
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground">{h.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CameraScanOverlay
        open={cameraActive}
        onClose={() => setCameraActive(false)}
        onScan={(code, format) => processCode(code, format)}
        onError={handleCameraError}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((s) => !s)}
        batchMode={batchMode}
        onToggleBatch={() => setBatchMode((b) => !b)}
        result={lastResult}
        scanCount={scanCount}
      />
    </div>
  );
}
