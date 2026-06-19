"use server";

import { withAuth, ok, fail, parseInput, z, ERR, logAudit } from "@/lib/server";

const paymentMethodEnum = z.enum([
  "cash",
  "card",
  "bank_transfer",
  "credit",
  "check",
  "other",
]);

function statusFor(paid: number, total: number): "unpaid" | "partial" | "paid" {
  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}

// ============================================
// RECORD / LIST / DELETE PAYMENTS (tahsilat & tediye)
// ============================================

const recordPaymentSchema = z
  .object({
    direction: z.enum(["inbound", "outbound"]),
    method: paymentMethodEnum.default("cash"),
    amount: z.number().positive("Tutar 0'dan büyük olmalı"),
    customerId: z.string().optional(),
    supplierId: z.string().optional(),
    salesOrderId: z.string().optional(),
    purchaseOrderId: z.string().optional(),
    saleId: z.string().optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    paidAt: z.string().optional(),
  })
  .refine((v) => v.customerId || v.supplierId, {
    message: "Müşteri veya tedarikçi seçin",
  });

export const recordPayment = withAuth<
  z.input<typeof recordPaymentSchema>,
  { paymentId: string }
>(async (ctx, raw) => {
  const data = parseInput(recordPaymentSchema, raw);

  // Ownership checks for whatever was provided.
  if (data.customerId) {
    const c = await ctx.prisma.customer.findFirst({
      where: { id: data.customerId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!c) throw ERR.notFound("Müşteri");
  }
  if (data.supplierId) {
    const s = await ctx.prisma.supplier.findFirst({
      where: { id: data.supplierId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!s) throw ERR.notFound("Tedarikçi");
  }

  const paymentId = await ctx.prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        companyId: ctx.companyId,
        direction: data.direction,
        method: data.method,
        amount: data.amount,
        customerId: data.customerId ?? null,
        supplierId: data.supplierId ?? null,
        salesOrderId: data.salesOrderId ?? null,
        purchaseOrderId: data.purchaseOrderId ?? null,
        saleId: data.saleId ?? null,
        reference: data.reference ?? null,
        notes: data.notes ?? null,
        paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
        userId: ctx.userId,
      },
      select: { id: true },
    });

    // Keep the linked document's paid amount in sync.
    if (data.salesOrderId) {
      const o = await tx.salesOrder.findFirst({
        where: { id: data.salesOrderId, companyId: ctx.companyId },
        select: { paidAmount: true, totalAmount: true },
      });
      if (o) {
        const paid = Number(o.paidAmount) + data.amount;
        await tx.salesOrder.update({
          where: { id: data.salesOrderId },
          data: { paidAmount: paid, paymentStatus: statusFor(paid, Number(o.totalAmount)) },
        });
      }
    }
    if (data.purchaseOrderId) {
      const o = await tx.purchaseOrder.findFirst({
        where: { id: data.purchaseOrderId, companyId: ctx.companyId },
        select: { paidAmount: true, totalAmount: true },
      });
      if (o) {
        const paid = Number(o.paidAmount) + data.amount;
        await tx.purchaseOrder.update({
          where: { id: data.purchaseOrderId },
          data: { paidAmount: paid, paymentStatus: statusFor(paid, Number(o.totalAmount)) },
        });
      }
    }
    if (data.saleId) {
      const sale = await tx.sale.findFirst({
        where: { id: data.saleId, companyId: ctx.companyId },
        select: { paidAmount: true, totalAmount: true },
      });
      if (sale) {
        const paid = Number(sale.paidAmount) + data.amount;
        await tx.sale.update({
          where: { id: data.saleId },
          data: { paidAmount: paid, paymentStatus: statusFor(paid, Number(sale.totalAmount)) },
        });
      }
    }

    return payment.id;
  });

  await logAudit(ctx, {
    action: "create",
    table: "payments",
    recordId: paymentId,
    newData: { direction: data.direction, amount: data.amount },
  });

  return ok({ paymentId });
});

export interface PaymentRow {
  id: string;
  direction: "inbound" | "outbound";
  method: string;
  amount: number;
  partyName: string;
  partyType: "customer" | "supplier" | null;
  reference: string | null;
  notes: string | null;
  paidAt: string;
}

export const listPayments = withAuth<
  { direction?: "inbound" | "outbound"; customerId?: string; supplierId?: string } | undefined,
  PaymentRow[]
>(async (ctx, filters) => {
  const rows = await ctx.prisma.payment.findMany({
    where: {
      companyId: ctx.companyId,
      ...(filters?.direction ? { direction: filters.direction } : {}),
      ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      ...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
    },
    orderBy: { paidAt: "desc" },
    take: 300,
    include: {
      customer: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });

  return ok(
    rows.map((p) => ({
      id: p.id,
      direction: p.direction,
      method: p.method,
      amount: Number(p.amount),
      partyName: p.customer?.name ?? p.supplier?.name ?? "—",
      partyType: p.customerId ? "customer" : p.supplierId ? "supplier" : null,
      reference: p.reference,
      notes: p.notes,
      paidAt: p.paidAt.toISOString(),
    }))
  );
});

/** Delete a payment, reversing any paid-amount it applied to a linked document. */
export const deletePayment = withAuth<string, void>(async (ctx, id) => {
  const payment = await ctx.prisma.payment.findFirst({
    where: { id, companyId: ctx.companyId },
    select: {
      id: true,
      amount: true,
      salesOrderId: true,
      purchaseOrderId: true,
      saleId: true,
    },
  });
  if (!payment) throw ERR.notFound("Ödeme");
  const amount = Number(payment.amount);

  await ctx.prisma.$transaction(async (tx) => {
    if (payment.salesOrderId) {
      const o = await tx.salesOrder.findUnique({
        where: { id: payment.salesOrderId },
        select: { paidAmount: true, totalAmount: true },
      });
      if (o) {
        const paid = Math.max(0, Number(o.paidAmount) - amount);
        await tx.salesOrder.update({
          where: { id: payment.salesOrderId },
          data: { paidAmount: paid, paymentStatus: statusFor(paid, Number(o.totalAmount)) },
        });
      }
    }
    if (payment.purchaseOrderId) {
      const o = await tx.purchaseOrder.findUnique({
        where: { id: payment.purchaseOrderId },
        select: { paidAmount: true, totalAmount: true },
      });
      if (o) {
        const paid = Math.max(0, Number(o.paidAmount) - amount);
        await tx.purchaseOrder.update({
          where: { id: payment.purchaseOrderId },
          data: { paidAmount: paid, paymentStatus: statusFor(paid, Number(o.totalAmount)) },
        });
      }
    }
    if (payment.saleId) {
      const sale = await tx.sale.findUnique({
        where: { id: payment.saleId },
        select: { paidAmount: true, totalAmount: true },
      });
      if (sale) {
        const paid = Math.max(0, Number(sale.paidAmount) - amount);
        await tx.sale.update({
          where: { id: payment.saleId },
          data: { paidAmount: paid, paymentStatus: statusFor(paid, Number(sale.totalAmount)) },
        });
      }
    }
    await tx.payment.delete({ where: { id: payment.id } });
  });

  return ok();
});
