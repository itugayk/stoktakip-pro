"use client";

/**
 * Detects barcodes typed by USB/Bluetooth HID scanners. They emulate a keyboard
 * and burst-type the digits + Enter in ~5-20ms per character — far faster than
 * a human (~80ms+).
 *
 * Usage:
 *   const stop = scanDetector.start({ onScan: (code) => ... });
 *   // later
 *   stop();
 *
 * Implementation:
 *   - Buffer keystrokes.
 *   - If two consecutive keys arrive within `gapMs`, treat them as a scan.
 *   - Emit on Enter, or after `idleMs` of no input (catches scanners without Enter).
 *   - Skip when focus is on an editable element (so the user can still type).
 */

export interface ScanDetectorOptions {
  onScan: (code: string) => void;
  /** Max ms between keys to still count as the same burst. Defaults to 50ms. */
  gapMs?: number;
  /** Flush after this many ms of silence. Defaults to 120ms. */
  idleMs?: number;
  /** Minimum length to accept. Most barcodes are 8+. Defaults to 4. */
  minLength?: number;
  /** Set to true to also run while focus is in an input — useful on dedicated
   *  scan pages where the hidden input is part of the design. */
  allowInInputs?: boolean;
}

export const scanDetector = {
  start({
    onScan,
    gapMs = 50,
    idleMs = 120,
    minLength = 4,
    allowInInputs = false,
  }: ScanDetectorOptions): () => void {
    if (typeof window === "undefined") return () => {};

    let buf = "";
    let lastTime = 0;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (buf.length >= minLength) onScan(buf);
      buf = "";
      lastTime = 0;
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (!allowInInputs && isEditable(e.target)) return;
      // Ignore modifier-only / function keys.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = performance.now();
      const gap = lastTime ? now - lastTime : 0;

      if (e.key === "Enter") {
        if (buf.length > 0) {
          e.preventDefault();
          flush();
        }
        return;
      }

      // Only single printable characters extend the buffer.
      if (e.key.length !== 1) return;

      // If the last key was too long ago, restart the buffer.
      if (lastTime && gap > gapMs) buf = "";

      buf += e.key;
      lastTime = now;

      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(flush, idleMs);
    };

    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (idleTimer) clearTimeout(idleTimer);
    };
  },
};

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}
