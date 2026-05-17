"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface OrderPdfInput {
  /** "Satın Alma" / "Satış". */
  kind: "purchase" | "sales";
  orderNumber: string;
  orderDate: string;
  partner: {
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  company: {
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
    bankAccount?: string;
  };
  currency: string;
  items: {
    name: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    total: number;
  }[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
}

const formatPrice = (n: number, currency: string) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(n);

export function generateOrderPdf(input: OrderPdfInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // Header: company name (left) + order title (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(input.company.name, margin, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const title = input.kind === "purchase" ? "SATIN ALMA SİPARİŞİ" : "SATIŞ SİPARİŞİ";
  doc.text(title, pageW - margin, y + 6, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (input.company.taxId) doc.text(`Vergi No: ${input.company.taxId}`, margin, y + 11);
  if (input.company.address) doc.text(input.company.address, margin, y + 15, { maxWidth: pageW / 2 - margin });
  doc.text(`No: ${input.orderNumber}`, pageW - margin, y + 11, { align: "right" });
  doc.text(`Tarih: ${input.orderDate}`, pageW - margin, y + 15, { align: "right" });

  y += 25;

  // Partner block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(input.kind === "purchase" ? "Tedarikçi" : "Müşteri", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 4;
  doc.text(input.partner.name, margin, y);
  if (input.partner.taxId) {
    y += 4;
    doc.text(`Vergi No: ${input.partner.taxId}`, margin, y);
  }
  if (input.partner.address) {
    y += 4;
    doc.text(input.partner.address, margin, y, { maxWidth: pageW - margin * 2 });
  }
  if (input.partner.phone || input.partner.email) {
    y += 4;
    doc.text([input.partner.phone, input.partner.email].filter(Boolean).join(" · "), margin, y);
  }
  y += 6;

  // Items table
  autoTable(doc, {
    startY: y,
    head: [["#", "Ürün", "Adet", "Birim Fiyat", "KDV", "Tutar"]],
    body: input.items.map((it, i) => [
      String(i + 1),
      `${it.name}${it.sku ? `\n${it.sku}` : ""}`,
      it.quantity.toString(),
      formatPrice(it.unitPrice, input.currency),
      it.taxRate != null ? `${it.taxRate}%` : "—",
      formatPrice(it.total, input.currency),
    ]),
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8 },
      2: { halign: "right", cellWidth: 18 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "right", cellWidth: 16 },
      5: { halign: "right", cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
  });

  // jsPDF autotable mutates doc.lastAutoTable. Use it for placement.
  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Totals (right-aligned)
  const totalsX = pageW - margin;
  const labelX = totalsX - 50;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Ara Toplam:", labelX, afterTable);
  doc.text(formatPrice(input.subtotal, input.currency), totalsX, afterTable, { align: "right" });
  doc.text("KDV:", labelX, afterTable + 6);
  doc.text(formatPrice(input.taxAmount, input.currency), totalsX, afterTable + 6, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text("Toplam:", labelX, afterTable + 13);
  doc.text(formatPrice(input.totalAmount, input.currency), totalsX, afterTable + 13, { align: "right" });

  let footerY = afterTable + 22;

  if (input.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Not: ${input.notes}`, margin, footerY, { maxWidth: pageW - margin * 2 });
    footerY += 10;
  }

  if (input.company.bankAccount) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Banka: ${input.company.bankAccount}`, margin, footerY);
    footerY += 6;
  }

  // Signature blocks
  const sigY = Math.max(footerY + 15, doc.internal.pageSize.getHeight() - 30);
  doc.setDrawColor(150);
  doc.line(margin, sigY, margin + 60, sigY);
  doc.line(pageW - margin - 60, sigY, pageW - margin, sigY);
  doc.setFontSize(8);
  doc.text("Hazırlayan", margin + 30, sigY + 4, { align: "center" });
  doc.text("Onay", pageW - margin - 30, sigY + 4, { align: "center" });

  doc.save(`siparis_${input.orderNumber}.pdf`);
}
