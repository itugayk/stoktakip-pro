"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface DeliveryNotePdfInput {
  /** "outbound" = customer (Sevk/Satış İrsaliyesi), "inbound" = supplier (Alış İrsaliyesi). */
  type: "outbound" | "inbound";
  noteNumber: string;
  issueDate: string;
  party: {
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
  } | null;
  company: {
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
  };
  items: {
    name: string;
    sku?: string;
    quantity: number;
    unit: string;
    lotNumber?: string | null;
  }[];
  notes?: string | null;
}

export function generateDeliveryNotePdf(input: DeliveryNotePdfInput): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(input.company.name, margin, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const title = input.type === "outbound" ? "SEVK İRSALİYESİ" : "ALIŞ İRSALİYESİ";
  doc.text(title, pageW - margin, y + 6, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (input.company.taxId) doc.text(`Vergi No: ${input.company.taxId}`, margin, y + 11);
  if (input.company.address) doc.text(input.company.address, margin, y + 15, { maxWidth: pageW / 2 - margin });
  doc.text(`İrsaliye No: ${input.noteNumber}`, pageW - margin, y + 11, { align: "right" });
  doc.text(`Tarih: ${input.issueDate}`, pageW - margin, y + 15, { align: "right" });

  y += 25;

  // Party block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(input.type === "outbound" ? "Alıcı (Müşteri)" : "Gönderen (Tedarikçi)", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 4;
  if (input.party) {
    doc.text(input.party.name, margin, y);
    if (input.party.taxId) { y += 4; doc.text(`Vergi No: ${input.party.taxId}`, margin, y); }
    if (input.party.address) { y += 4; doc.text(input.party.address, margin, y, { maxWidth: pageW - margin * 2 }); }
    if (input.party.phone) { y += 4; doc.text(input.party.phone, margin, y); }
  } else {
    doc.text("—", margin, y);
  }
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["#", "Ürün", "Lot/Seri", "Miktar", "Birim"]],
    body: input.items.map((it, i) => [
      String(i + 1),
      `${it.name}${it.sku ? `\n${it.sku}` : ""}`,
      it.lotNumber ?? "—",
      it.quantity.toString(),
      it.unit,
    ]),
    headStyles: { fillColor: [99, 102, 241], textColor: 255 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8 },
      3: { halign: "right", cellWidth: 24 },
      4: { cellWidth: 24 },
    },
    margin: { left: margin, right: margin },
  });

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  let footerY = afterTable;

  if (input.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Not: ${input.notes}`, margin, footerY, { maxWidth: pageW - margin * 2 });
    footerY += 10;
  }

  // Signature blocks
  const sigY = Math.max(footerY + 15, doc.internal.pageSize.getHeight() - 30);
  doc.setDrawColor(150);
  doc.line(margin, sigY, margin + 60, sigY);
  doc.line(pageW - margin - 60, sigY, pageW - margin, sigY);
  doc.setFontSize(8);
  doc.text("Teslim Eden", margin + 30, sigY + 4, { align: "center" });
  doc.text("Teslim Alan", pageW - margin - 30, sigY + 4, { align: "center" });

  doc.save(`irsaliye_${input.noteNumber}.pdf`);
}
