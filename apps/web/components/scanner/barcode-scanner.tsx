"use client";

import { useEffect, useRef, useCallback, useId } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

export interface ScannerResult {
  text: string;
  format?: string;
}

interface BarcodeScannerProps {
  onScan: (result: ScannerResult) => void;
  onError?: (error: string) => void;
  active: boolean;
  className?: string;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

export function BarcodeScanner({ onScan, onError, active, className }: BarcodeScannerProps) {
  const scannerId = `barcode-scanner-${useId().replace(/:/g, "")}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScanningRef = useRef(false);
  const lastScanRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  const startScanner = useCallback(async () => {
    if (!containerRef.current || isScanningRef.current) return;

    try {
      if (!window.isSecureContext) {
        onError?.("Telefonda kamera için HTTPS gerekli. Sunucuyu HTTPS modunda açıp güvenli adresi kullanın.");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        onError?.("Bu tarayıcı kamera erişimini desteklemiyor veya kamera izni kapalı.");
        return;
      }

      isScanningRef.current = true;

      // Ensure the container has a child div for the scanner
      let scannerDiv = document.getElementById(scannerId);
      if (!scannerDiv) {
        scannerDiv = document.createElement("div");
        scannerDiv.id = scannerId;
        containerRef.current.appendChild(scannerDiv);
      }

      const scanner = new Html5Qrcode(scannerId, {
        formatsToSupport: SUPPORTED_FORMATS,
        useBarCodeDetectorIfSupported: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        verbose: false,
      });

      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(
              Math.max(250, Math.floor(viewfinderWidth * 0.85)),
              viewfinderWidth - 20
            );
            const height = Math.min(
              Math.max(100, Math.floor(viewfinderHeight * 0.25)),
              viewfinderHeight - 20
            );

            return { width, height };
          },
          aspectRatio: 1.7778,
          disableFlip: false,
        },
        (decodedText, result) => {
          const now = Date.now();
          // Debounce: avoid scanning same code within 2 seconds
          if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 2000) {
            return;
          }
          lastScanRef.current = decodedText;
          lastScanTimeRef.current = now;

          onScan({
            text: decodedText,
            format: result?.result?.format?.formatName,
          });
        },
        () => {
          // Error scanning — silent, this fires constantly when no code is visible
        }
      );

    } catch (err) {
      isScanningRef.current = false;
      const msg = err instanceof Error ? err.message : "Kamera başlatılamadı";
      onError?.(msg);
    }
  }, [onScan, onError, scannerId]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current && isScanningRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
      isScanningRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (active) {
      queueMicrotask(() => {
        if (!cancelled) {
          void startScanner();
        }
      });
    } else {
      void stopScanner();
    }

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [active, startScanner, stopScanner]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ minHeight: active ? 300 : 0 }}
    />
  );
}
