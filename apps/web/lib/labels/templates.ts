/**
 * Label layout templates for PDF export.
 * `unit: "mm"` keeps numbers small and predictable; jsPDF is configured with
 * `unit: "mm"` to match.
 */

export interface LabelTemplate {
  id: string;
  label: string;
  /** Page size in mm. */
  pageSize: { width: number; height: number };
  /** Single label size in mm. */
  labelSize: { width: number; height: number };
  /** Grid: how many labels fit on one page. */
  grid: { cols: number; rows: number };
  /** Inner gap between labels in mm. */
  gap: { x: number; y: number };
  /** Outer page margins in mm. */
  margin: { top: number; left: number };
}

export const LABEL_TEMPLATES: LabelTemplate[] = [
  {
    id: "thermal-50x30",
    label: "Termal Rulo 50×30 mm",
    pageSize: { width: 50, height: 30 },
    labelSize: { width: 50, height: 30 },
    grid: { cols: 1, rows: 1 },
    gap: { x: 0, y: 0 },
    margin: { top: 0, left: 0 },
  },
  {
    id: "thermal-38x25",
    label: "Termal Rulo 38×25 mm",
    pageSize: { width: 38, height: 25 },
    labelSize: { width: 38, height: 25 },
    grid: { cols: 1, rows: 1 },
    gap: { x: 0, y: 0 },
    margin: { top: 0, left: 0 },
  },
  {
    id: "a4-3x8",
    label: "A4 Sayfa (3 × 8 = 24 etiket)",
    pageSize: { width: 210, height: 297 },
    labelSize: { width: 64, height: 33.85 },
    grid: { cols: 3, rows: 8 },
    gap: { x: 3, y: 0 },
    margin: { top: 13, left: 7 },
  },
];

export interface LabelFields {
  /** Show the company / shop name. */
  showLogo: boolean;
  /** Show the product name. */
  showName: boolean;
  /** Show SKU below the barcode. */
  showSku: boolean;
  /** Show sale price. */
  showPrice: boolean;
  /** Show expiry date if present. */
  showExpiry: boolean;
}

export const DEFAULT_FIELDS: LabelFields = {
  showLogo: false,
  showName: true,
  showSku: true,
  showPrice: true,
  showExpiry: false,
};
