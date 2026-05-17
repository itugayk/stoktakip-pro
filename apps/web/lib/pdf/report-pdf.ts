"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReportPdfInput {
  title: string;
  subtitle?: string;
  /** Date range string (e.g. "01.01.2026 — 31.01.2026"). Shown in header. */
  period?: string;
  company: { name: string; taxId?: string; address?: string; logoUrl?: string };
  /** Stats shown as a row of "name: value" tiles below the header. */
  summary?: { label: string; value: string }[];
  /** Tabular data — first row is the header. */
  columns: string[];
  rows: (string | number)[][];
  /** Optional column alignment (default: text-left, last column right). */
  columnAlign?: ("left" | "right" | "center")[];
  /** Free-form footer text (signed-by name, etc.) */
  footer?: string;
}

export function generateReportPdf(input: ReportPdfInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header band
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(input.company.name, margin, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (input.company.taxId) doc.text(`VKN: ${input.company.taxId}`, margin, 16);
  if (input.company.address) doc.text(input.company.address, margin, 21, { maxWidth: pageW / 2 - margin });

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(input.title, pageW - margin, 11, { align: "right" });
  if (input.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(input.subtitle, pageW - margin, 16, { align: "right" });
  }
  if (input.period) {
    doc.setFontSize(8);
    doc.text(input.period, pageW - margin, 21, { align: "right" });
  }

  doc.setTextColor(0, 0, 0);
  let y = 32;

  // Summary tiles
  if (input.summary && input.summary.length > 0) {
    const tileW = (pageW - margin * 2 - 4 * (input.summary.length - 1)) / input.summary.length;
    for (let i = 0; i < input.summary.length; i++) {
      const x = margin + i * (tileW + 4);
      doc.setDrawColor(220);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, tileW, 16, 2, 2, "FD");
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(input.summary[i].label, x + 3, y + 5);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(input.summary[i].value, x + 3, y + 12);
      doc.setFont("helvetica", "normal");
    }
    y += 22;
  }

  // Table
  const colCount = input.columns.length;
  const aligns = input.columnAlign ?? Array.from({ length: colCount }, (_, i) =>
    i === colCount - 1 ? "right" : "left"
  );

  autoTable(doc, {
    startY: y,
    head: [input.columns],
    body: input.rows.map((r) => r.map((c) => String(c))),
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    styles: { font: "helvetica", cellPadding: 2 },
    columnStyles: aligns.reduce(
      (acc, a, i) => {
        acc[i] = { halign: a };
        return acc;
      },
      {} as Record<number, { halign: "left" | "right" | "center" }>
    ),
    margin: { left: margin, right: margin },
  });

  if (input.footer) {
    const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(input.footer, margin, afterTable, { maxWidth: pageW - margin * 2 });
  }

  // Page numbers
  const totalPages = (doc as unknown as { internal: { pages: { length: number } } }).internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`${p} / ${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 6, { align: "right" });
    doc.text(`Üretildi: ${new Date().toLocaleString("tr-TR")}`, margin, doc.internal.pageSize.getHeight() - 6);
  }

  const safe = input.title.replace(/[^\p{L}\p{N}_\-]/gu, "_").toLowerCase();
  doc.save(`${safe}_${new Date().toISOString().split("T")[0]}.pdf`);
}
