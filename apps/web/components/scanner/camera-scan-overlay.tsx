"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { X, Volume2, VolumeX, Zap, CheckCircle2, XCircle, ScanLine } from "lucide-react";
import type { ScannerResult } from "@/components/scanner/barcode-scanner";
import { unlockAudio } from "@/lib/feedback";

const BarcodeScanner = dynamic(
  () => import("@/components/scanner/barcode-scanner").then((m) => m.BarcodeScanner),
  { ssr: false }
);

export interface ScanResultInfo {
  /** Increments on every scan so the flash/animation re-triggers even for repeats. */
  seq: number;
  found: boolean;
  title: string;
  subtitle?: string;
  code: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (code: string, format?: string) => void;
  onError?: (msg: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  batchMode?: boolean;
  onToggleBatch?: () => void;
  /** Hide the batch toggle (e.g. in POS, where every scan adds to the cart). */
  showBatch?: boolean;
  /** Custom hint under the frame; defaults to a generic alignment prompt. */
  hint?: string;
  /** Last scan outcome, surfaced by the parent's scan handler. */
  result?: ScanResultInfo | null;
  /** Running count badge (e.g. number of scans this session). */
  scanCount?: number;
}

/**
 * Full-screen, design-forward camera scanner. Lives above everything (incl. the
 * mobile bottom-nav) so the viewfinder is never buried or clipped. A centered
 * scan frame (corner brackets + animated reticle) with a dimmed surround, plus a
 * colour-coded result sheet that slides up and a brief flash on each read.
 */
export function CameraScanOverlay({
  open,
  onClose,
  onScan,
  onError,
  soundEnabled,
  onToggleSound,
  batchMode = false,
  onToggleBatch,
  showBatch = true,
  hint,
  result,
  scanCount = 0,
}: Props) {
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);

  useEffect(() => {
    if (!result) return;
    setFlash(result.found ? "ok" : "err");
    const t = setTimeout(() => setFlash(null), 320);
    return () => clearTimeout(t);
  }, [result?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    // Opening is triggered by a tap; resume the audio context so the first
    // camera read (not a gesture itself) can beep.
    unlockAudio();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const handleScan = (r: ScannerResult) => onScan(r.text, r.format);

  // Portal to <body> so the layer escapes any transformed/overflow-clipped
  // ancestor (e.g. a Radix dialog's translate-centered content) and always
  // covers the true viewport — above the mobile bottom-nav, never buried.
  return createPortal(
    <div className="camov-root fixed inset-0 z-[80] bg-black">
      {/* Camera feed */}
      <BarcodeScanner active={open} onScan={handleScan} onError={onError} className="absolute inset-0" />

      {/* Scan frame: dimmed surround (box-shadow) + corner brackets + reticle.
          Single absolutely-positioned source of truth so mask and brackets align. */}
      <div className="camov-frame pointer-events-none">
        <span className="camov-corner camov-tl" />
        <span className="camov-corner camov-tr" />
        <span className="camov-corner camov-bl" />
        <span className="camov-corner camov-br" />
        <span className="camov-line" />
      </div>
      <p className="camov-hint pointer-events-none">
        {hint ?? (batchMode ? "Arka arkaya tarayın" : "Barkodu çerçeveye hizalayın")}
      </p>

      {/* Brief full-frame flash on each read */}
      {flash && (
        <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${flash === "ok" ? "bg-emerald-400/25" : "bg-rose-500/25"}`} />
      )}

      {/* Controls — painted above the mask */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {/* Top bar */}
        <div
          className="pointer-events-auto flex items-center justify-between gap-2 px-4 pb-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
        >
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md active:scale-95 transition"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-white backdrop-blur-md">
            <ScanLine className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Barkod Tara</span>
            {scanCount > 0 && <span className="ml-1 rounded-full bg-white/15 px-2 text-xs tabular-nums">{scanCount}</span>}
          </div>
          <div className="flex items-center gap-2">
            {showBatch && (
              <button
                onClick={onToggleBatch}
                aria-label="Toplu tarama"
                className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md active:scale-95 transition ${batchMode ? "bg-primary text-primary-foreground" : "bg-black/50 text-white"}`}
              >
                <Zap className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={onToggleSound}
              aria-label="Ses"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md active:scale-95 transition"
            >
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="flex-1" />

        {/* Result sheet */}
        <div className="pointer-events-auto px-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}>
          {result ? (
            <div
              key={result.seq}
              className={`camov-sheet flex items-center gap-3 rounded-2xl border p-4 backdrop-blur-xl ${result.found ? "border-emerald-400/30 bg-emerald-950/70" : "border-rose-500/30 bg-rose-950/70"}`}
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${result.found ? "bg-emerald-400/20" : "bg-rose-500/20"}`}>
                {result.found ? <CheckCircle2 className="h-6 w-6 text-emerald-400" /> : <XCircle className="h-6 w-6 text-rose-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{result.title}</p>
                {result.subtitle && <p className="truncate text-xs text-white/70">{result.subtitle}</p>}
              </div>
              <span className="shrink-0 rounded-md bg-white/10 px-2 py-1 font-mono text-[11px] text-white/70">{result.code}</span>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/45 p-4 text-center text-sm text-white/70 backdrop-blur-md">
              Kamerayı barkoda doğrultun — okuma otomatik yapılır
            </div>
          )}
        </div>
      </div>

      {/* Scoped styles: make html5-qrcode's <video> cover the frame, hide its
          default shaded overlay, and lay out + animate the custom reticle. */}
      <style>{`
        /* Force html5-qrcode's injected container AND its <video> to fill the
           full-screen layer. Without this the video renders as a short band
           (percentage height resolves against an auto-height parent) and looks
           like it's "stuck at the bottom". */
        .camov-root [id^="barcode-scanner-"] {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
        .camov-root video {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        .camov-root #qr-shaded-region { display: none !important; }
        .camov-root img[alt="Info icon"] { display: none !important; }
        .camov-frame {
          position: absolute;
          left: 50%;
          top: 17vh;
          transform: translateX(-50%);
          width: min(78vw, 320px);
          height: min(42vw, 200px);
          border-radius: 20px;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.55);
        }
        .camov-hint {
          position: absolute;
          left: 0; right: 0;
          top: calc(17vh + min(42vw, 200px) + 18px);
          text-align: center;
          color: rgba(255,255,255,0.9);
          font-size: 0.875rem;
        }
        .camov-corner {
          position: absolute;
          width: 30px; height: 30px;
          border: 3px solid hsl(252 87% 67%);
          filter: drop-shadow(0 0 6px hsl(252 87% 60% / 0.8));
        }
        .camov-tl { top: 0; left: 0; border-right: 0; border-bottom: 0; border-top-left-radius: 16px; }
        .camov-tr { top: 0; right: 0; border-left: 0; border-bottom: 0; border-top-right-radius: 16px; }
        .camov-bl { bottom: 0; left: 0; border-right: 0; border-top: 0; border-bottom-left-radius: 16px; }
        .camov-br { bottom: 0; right: 0; border-left: 0; border-top: 0; border-bottom-right-radius: 16px; }
        .camov-line {
          position: absolute;
          left: 10px; right: 10px;
          height: 2px;
          border-radius: 2px;
          background: linear-gradient(90deg, transparent, hsl(252 87% 67%), transparent);
          box-shadow: 0 0 10px 2px hsl(252 87% 60% / 0.7);
          animation: camov-scan 2.2s ease-in-out infinite;
        }
        @keyframes camov-scan {
          0%   { top: 6%;  opacity: 0.4; }
          50%  { top: 90%; opacity: 1; }
          100% { top: 6%;  opacity: 0.4; }
        }
        .camov-sheet { animation: camov-rise 0.22s ease-out; }
        @keyframes camov-rise {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
