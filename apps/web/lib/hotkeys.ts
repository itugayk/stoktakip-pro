/**
 * Central registry of keyboard shortcuts shown in the "?" help dialog.
 * The actual bindings live in `hooks/use-hotkey.ts` and the dashboard layout
 * (Cmd+K → palette; "?" → help dialog).
 *
 * Naming convention: keys use `Ctrl+K` / `Cmd+K` interchangeably; platform
 * detection happens at runtime.
 */

export interface Hotkey {
  /** Display key (e.g. "Ctrl+K", "G I", "?"). */
  keys: string;
  description: string;
  /** Group label shown in the help dialog. */
  group: "Genel" | "Navigasyon" | "Aksiyon";
}

export const HOTKEYS: readonly Hotkey[] = [
  // Genel
  { keys: "Ctrl+K", description: "Komut paletini aç", group: "Genel" },
  { keys: "/", description: "Global aramaya odaklan", group: "Genel" },
  { keys: "Esc", description: "Modal / diyalog kapat", group: "Genel" },
  { keys: "?", description: "Bu kısayol listesini aç", group: "Genel" },

  // Navigasyon
  { keys: "G D", description: "Dashboard", group: "Navigasyon" },
  { keys: "G P", description: "Ürünler", group: "Navigasyon" },
  { keys: "G I", description: "Envanter (Stok Hareketleri)", group: "Navigasyon" },
  { keys: "G S", description: "Tarayıcı", group: "Navigasyon" },
  { keys: "G C", description: "Kategoriler", group: "Navigasyon" },
  { keys: "G R", description: "Raporlar", group: "Navigasyon" },

  // Aksiyon
  { keys: "N", description: "Yeni (bağlama göre: ürün / sipariş)", group: "Aksiyon" },
];

/**
 * Resolves "G P" → dashboard route. Used by the chord hotkey hook.
 */
export const NAV_CHORDS: Record<string, string> = {
  d: "/dashboard",
  p: "/dashboard/products",
  i: "/dashboard/inventory",
  s: "/dashboard/scanner",
  c: "/dashboard/categories",
  r: "/dashboard/reports",
};

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

/** Pretty-print a `Ctrl+K` token: shows `⌘K` on Mac, `Ctrl+K` elsewhere. */
export function formatKeys(keys: string): string {
  if (!isMac()) return keys;
  return keys.replace(/Ctrl/gi, "⌘").replace(/Alt/gi, "⌥").replace(/Shift/gi, "⇧");
}
