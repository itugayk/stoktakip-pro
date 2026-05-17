"use client";

import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";
import type { LabelTemplate, LabelFields } from "./templates";

export interface LabelInput {
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  salePrice?: number;
  /** How many copies of this label to print. */
  copies: number;
}

export interface PdfOptions {
  template: LabelTemplate;
  fields: LabelFields;
  /** Logo / company name to show on each label. */
  logoText?: string;
  items: LabelInput[];
}

/** Renders a barcode SVG on an offscreen canvas, returns dataURL (PNG). */
function barcodeToDataUrl(value: string): string {
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, value, {
      format: "CODE128",
      displayValue: false,
      width: 2,
      height: 50,
      margin: 0,
    });
  } catch {
    // Fallback: empty white canvas if the code can't be rendered.
    canvas.width = 100;
    canvas.height = 30;
  }
  return canvas.toDataURL("image/png");
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(n);
}

/**
 * Build a multi-page PDF of labels and trigger download.
 * Returns the number of labels written.
 */
export function generateLabelsPdf({
  template,
  fields,
  logoText,
  items,
}: PdfOptions): number {
  const doc = new jsPDF({
    unit: "mm",
    format: [template.pageSize.width, template.pageSize.height],
    orientation:
      template.pageSize.width > template.pageSize.height ? "landscape" : "portrait",
  });

  const { cols, rows } = template.grid;
  const perPage = cols * rows;
  let idx = 0;
  let printed = 0;

  // Expand into individual labels respecting `copies`.
  const expanded: LabelInput[] = [];
  for (const it of items) {
    for (let i = 0; i < Math.max(1, it.copies); i++) expanded.push(it);
  }

  for (const it of expanded) {
    if (idx > 0 && idx % perPage === 0) doc.addPage();
    const slot = idx % perPage;
    const col = slot % cols;
    const row = Math.floor(slot / cols);

    const x = template.margin.left + col * (template.labelSize.width + template.gap.x);
    const y = template.margin.top + row * (template.labelSize.height + template.gap.y);
    const w = template.labelSize.width;
    const h = template.labelSize.height;

    drawLabel(doc, it, x, y, w, h, fields, logoText);
    idx++;
    printed++;
  }

  if (printed === 0) return 0;

  doc.save(`etiketler_${new Date().toISOString().split("T")[0]}.pdf`);
  return printed;
}

function drawLabel(
  doc: jsPDF,
  it: LabelInput,
  x: number,
  y: number,
  w: number,
  h: number,
  fields: LabelFields,
  logoText?: string
) {
  const padding = 1.5;
  let cursorY = y + padding;

  if (fields.showLogo && logoText) {
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.text(logoText, x + padding, cursorY + 2, { maxWidth: w - padding * 2 });
    cursorY += 3.5;
  }

  if (fields.showName) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    const lines = doc.splitTextToSize(it.name, w - padding * 2) as string[];
    doc.text(lines.slice(0, 2), x + padding, cursorY + 2.4);
    cursorY += lines.length === 1 ? 3.2 : 6.4;
  }

  // Barcode (centered)
  const code = it.barcode || it.sku;
  if (code) {
    try {
      const dataUrl = barcodeToDataUrl(code);
      const barH = Math.min(h - (cursorY - y) - 7, 12);
      const barW = w - padding * 2;
      doc.addImage(dataUrl, "PNG", x + padding, cursorY, barW, barH);
      cursorY += barH + 0.5;
    } catch {
      /* skip barcode on failure */
    }
  }

  // SKU / barcode digits under the bars
  if (fields.showSku) {
    doc.setFontSize(5.5);
    doc.setFont("courier", "normal");
    doc.text(code || it.sku, x + w / 2, cursorY + 2, { align: "center" });
    cursorY += 2.4;
  }

  if (fields.showPrice && typeof it.salePrice === "number") {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(formatPrice(it.salePrice), x + w / 2, y + h - padding, { align: "center" });
  }
}
