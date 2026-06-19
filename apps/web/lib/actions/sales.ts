"use server";

import {
  withAuth,
  ok,
  fail,
  parseInput,
  z,
  ERR,
  logAudit,
} from "@/lib/server";
import { applyStockMovement, allowNegativeStock } from "@/lib/inventory/engine";
import { assertModuleEnabled } from "@/lib/modules/guard";
import { customerBalance } from "@/lib/cari/balance";

const paymentMethodEnum = z.enum([
  "cash",
  "card",
  "bank_transfer",
  "credit",
  "check",
  "other",
]);

// ============================================
// HIZLI SATIŞ (POS) — direct sale, drops stock immediately
// ============================================

const createSaleSchema = z.object({
  customerId: z.string().optional(), // null/undefined = walk-in (peşin)
  warehouseId: z.string().min(1, "Depo seçin"),
  paymentMethod: paymentMethodEnum.default("cash"),
  paidAmount: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().positive("Miktar 0'dan büyük olmalı"),
        unitPrice: z.number().nonnegative().optional(),
        lotNumber: z.string().optional(),
      })
    )
    .min(1, "Sepette en az bir ürün olmalı"),
});

export const createSale = withAuth<
  z.input<typeof createSaleSchema>,
  { saleId: string; saleNumber: string }
>(async (ctx, raw) => {
  await assertModuleEnabled(ctx, "pos");
  const data = parseInput(createSaleSchema, raw);

  const [warehouse, customer, products] = await Promise.all([
    ctx.prisma.warehouse.findFirst({
      where: { id: data.warehouseId, companyId: ctx.companyId },
      select: { id: true },
    }),
    data.customerId
      ? ctx.prisma.customer.findFirst({
          where: { id: data.customerId, companyId: ctx.companyId },
          select: { id: true, creditLimit: true },
        })
      : Promise.resolve(null),
    ctx.prisma.product.findMany({
      where: {
        companyId: ctx.companyId,
        id: { in: data.items.map((i) => i.productId) },
      },
      select: { id: true, salePrice: true, taxRate: true },
    }),
  ]);
  if (!warehouse) throw ERR.notFound("Depo");
  if (data.customerId && !customer) throw ERR.notFound("Müşteri");

  const priceById = new Map(
    products.map((p) => [
      p.id,
      { sale: Number(p.salePrice), tax: Number(p.taxRate) },
    ])
  );

  let subtotal = 0;
  let taxAmount = 0;
  const itemData = data.items.map((it) => {
    const p = priceById.get(it.productId);
    if (!p) throw ERR.notFound("Ürün");
    const unitPrice = it.unitPrice ?? p.sale;
    const lineTotal = unitPrice * it.quantity;
    subtotal += lineTotal;
    taxAmount += lineTotal * (p.tax / 100);
    return {
      productId: it.productId,
      quantity: it.quantity,
      unitPrice,
      taxRate: p.tax,
      total: lineTotal,
      lotNumber: it.lotNumber ?? null,
    };
  });

  const discount = data.discount ?? 0;
  const totalAmount = Math.max(0, subtotal + taxAmount - discount);

  // Default paid amount: credit → 0, anything else → full.
  const paidAmount =
    data.paidAmount ?? (data.paymentMethod === "credit" ? 0 : totalAmount);
  const paymentStatus: "unpaid" | "partial" | "paid" =
    paidAmount <= 0 ? "unpaid" : paidAmount >= totalAmount ? "paid" : "partial";

  const saleNumber = `SAT-${Date.now().toString().slice(-8)}`;

  const result = await ctx.prisma.$transaction(async (tx) => {
    // Veresiye (credit) limit guard: only when a customer + a positive limit exist.
    const unpaid = totalAmount - paidAmount;
    if (customer && unpaid > 0 && Number(customer.creditLimit) > 0) {
      const current = await customerBalance(tx, ctx.companyId, customer.id);
      if (current + unpaid > Number(customer.creditLimit)) {
        throw new ERR_CREDIT(
          `Veresiye limiti aşılıyor (limit: ${Number(customer.creditLimit)}₺, mevcut borç: ${current.toFixed(2)}₺)`
        );
      }
    }

    const sale = await tx.sale.create({
      data: {
        companyId: ctx.companyId,
        customerId: data.customerId ?? null,
        warehouseId: data.warehouseId,
        saleNumber,
        subtotal,
        discount,
        taxAmount,
        totalAmount,
        paymentMethod: data.paymentMethod,
        paidAmount,
        paymentStatus,
        status: "completed",
        notes: data.notes ?? null,
        userId: ctx.userId,
        items: { create: itemData },
      },
      select: { id: true },
    });

    const allowNegative = await allowNegativeStock(tx, ctx.companyId);
    for (const it of itemData) {
      await applyStockMovement(tx, {
        companyId: ctx.companyId,
        productId: it.productId,
        movementType: "out",
        quantity: Number(it.quantity),
        fromWarehouseId: data.warehouseId,
        lotNumber: it.lotNumber,
        reason: "sale",
        referenceType: "sale",
        referenceNumber: sale.id,
        userId: ctx.userId,
        allowNegative,
      });
    }

    // Record the money actually collected as a payment (drives the cari ledger).
    if (paidAmount > 0) {
      await tx.payment.create({
        data: {
          companyId: ctx.companyId,
          direction: "inbound",
          method: data.paymentMethod === "credit" ? "cash" : data.paymentMethod,
          amount: paidAmount,
          customerId: data.customerId ?? null,
          saleId: sale.id,
          reference: saleNumber,
          userId: ctx.userId,
        },
      });
    }

    return sale.id;
  });

  await logAudit(ctx, {
    action: "create",
    table: "sales",
    recordId: result,
    newData: { saleNumber, totalAmount, paymentStatus },
  });

  return ok({ saleId: result, saleNumber });
});

// Small helper so the credit-limit guard surfaces as a clean `fail("credit_limit")`.
class ERR_CREDIT extends Error {
  readonly code = "credit_limit";
  constructor(message: string) {
    super(message);
    this.name = "CreditLimitError";
  }
}

// ============================================
// LIST / DETAIL / CANCEL
// ============================================

export interface SaleRow {
  id: string;
  saleNumber: string;
  customerId: string | null;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  itemCount: number;
  createdAt: string;
}

export const getSales = withAuth<
  { from?: string; to?: string; search?: string } | undefined,
  SaleRow[]
>(async (ctx, filters) => {
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (filters?.from) dateFilter.gte = new Date(filters.from);
  if (filters?.to) dateFilter.lte = new Date(filters.to);

  const rows = await ctx.prisma.sale.findMany({
    where: {
      companyId: ctx.companyId,
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      ...(filters?.search
        ? {
            OR: [
              { saleNumber: { contains: filters.search, mode: "insensitive" } },
              {
                customer: {
                  name: { contains: filters.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      customer: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  return ok(
    rows.map((s) => ({
      id: s.id,
      saleNumber: s.saleNumber,
      customerId: s.customerId,
      customerName: s.customer?.name ?? "Peşin müşteri",
      totalAmount: Number(s.totalAmount),
      paidAmount: Number(s.paidAmount),
      paymentMethod: s.paymentMethod,
      paymentStatus: s.paymentStatus,
      status: s.status,
      itemCount: s._count.items,
      createdAt: s.createdAt.toISOString(),
    }))
  );
});

export interface SaleDetail extends SaleRow {
  subtotal: number;
  discount: number;
  taxAmount: number;
  notes: string | null;
  warehouseId: string;
  customer: {
    name: string;
    taxId?: string;
    address?: string;
    phone?: string;
  } | null;
  company: { name: string; taxId?: string; address?: string; phone?: string };
  items: {
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    total: number;
  }[];
}

export const getSale = withAuth<string, SaleDetail | null>(async (ctx, saleId) => {
  const [s, company] = await Promise.all([
    ctx.prisma.sale.findFirst({
      where: { id: saleId, companyId: ctx.companyId },
      include: {
        customer: true,
        _count: { select: { items: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
    }),
    ctx.prisma.company.findUnique({
      where: { id: ctx.companyId },
      select: { name: true, taxId: true, address: true, phone: true },
    }),
  ]);
  if (!s) return ok(null);

  return ok({
    id: s.id,
    saleNumber: s.saleNumber,
    customerId: s.customerId,
    customerName: s.customer?.name ?? "Peşin müşteri",
    totalAmount: Number(s.totalAmount),
    paidAmount: Number(s.paidAmount),
    paymentMethod: s.paymentMethod,
    paymentStatus: s.paymentStatus,
    status: s.status,
    itemCount: s._count.items,
    createdAt: s.createdAt.toISOString(),
    subtotal: Number(s.subtotal),
    discount: Number(s.discount),
    taxAmount: Number(s.taxAmount),
    notes: s.notes,
    warehouseId: s.warehouseId,
    customer: s.customer
      ? {
          name: s.customer.name,
          taxId: s.customer.taxId ?? undefined,
          address: s.customer.address ?? undefined,
          phone: s.customer.phone ?? undefined,
        }
      : null,
    company: {
      name: company?.name ?? "",
      taxId: company?.taxId ?? undefined,
      address: company?.address ?? undefined,
      phone: company?.phone ?? undefined,
    },
    items: s.items.map((it) => ({
      productId: it.productId,
      name: it.product?.name ?? "—",
      sku: it.product?.sku ?? "",
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      taxRate: Number(it.taxRate),
      total: Number(it.total),
    })),
  });
});

/** Cancel a sale: returns the goods to stock and reverses its payments. */
export const cancelSale = withAuth<string, void>(async (ctx, saleId) => {
  const sale = await ctx.prisma.sale.findFirst({
    where: { id: saleId, companyId: ctx.companyId },
    select: {
      id: true,
      status: true,
      warehouseId: true,
      items: { select: { productId: true, quantity: true, lotNumber: true } },
    },
  });
  if (!sale) throw ERR.notFound("Satış");
  if (sale.status === "cancelled") {
    return fail("invalid_state", "Satış zaten iptal edilmiş");
  }

  await ctx.prisma.$transaction(async (tx) => {
    for (const it of sale.items) {
      await applyStockMovement(tx, {
        companyId: ctx.companyId,
        productId: it.productId,
        movementType: "return",
        quantity: Number(it.quantity),
        toWarehouseId: sale.warehouseId,
        lotNumber: it.lotNumber,
        reason: "sale_cancel",
        referenceType: "sale_cancel",
        referenceNumber: sale.id,
        userId: ctx.userId,
      });
    }
    await tx.payment.deleteMany({ where: { saleId: sale.id, companyId: ctx.companyId } });
    await tx.sale.update({
      where: { id: sale.id },
      data: { status: "cancelled", paidAmount: 0, paymentStatus: "unpaid" },
    });
  });

  await logAudit(ctx, {
    action: "update",
    table: "sales",
    recordId: sale.id,
    newData: { status: "cancelled" },
  });
  return ok();
});
