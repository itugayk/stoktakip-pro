"use server";

import type { Prisma } from "@prisma/client";
import { withCompany, ok, parseInput, z } from "@/lib/server";
import { fromProduct } from "@/lib/mappers";

const bulkImportSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().min(1),
        sku: z.string().min(1),
        barcode: z.string().optional(),
        categoryName: z.string().optional(),
        unit: z.string().default("adet"),
        minStock: z.number().nonnegative(),
        maxStock: z.number().nonnegative(),
        purchasePrice: z.number().nonnegative(),
        salePrice: z.number().nonnegative(),
        description: z.string().optional(),
      })
    )
    .min(1),
});

/**
 * Bulk-upsert products from an Excel import. SKU is the natural key —
 * existing rows are updated, new rows inserted. Categories are matched by
 * name and auto-created when missing.
 */
export const bulkImportProducts = withCompany<
  z.input<typeof bulkImportSchema>,
  {
    created: number;
    updated: number;
    errors: { sku: string; message: string }[];
  }
>(async (ctx, raw) => {
  const { rows } = parseInput(bulkImportSchema, raw);

  // Pre-load categories (small table).
  const existingCats = await ctx.prisma.category.findMany({
    where: { companyId: ctx.companyId },
    select: { id: true, name: true },
  });
  const catByName = new Map<string, string>(
    existingCats.map((c) => [c.name.toLowerCase(), c.id])
  );

  // Auto-create missing categories in a batch.
  const missingCategories = new Set<string>();
  for (const r of rows) {
    if (r.categoryName && !catByName.has(r.categoryName.toLowerCase())) {
      missingCategories.add(r.categoryName);
    }
  }
  for (const name of missingCategories) {
    try {
      const created = await ctx.prisma.category.create({
        data: { companyId: ctx.companyId, name },
        select: { id: true },
      });
      catByName.set(name.toLowerCase(), created.id);
    } catch {
      // Race or duplicate — try fetching the existing one
      const existing = await ctx.prisma.category.findFirst({
        where: { companyId: ctx.companyId, name },
        select: { id: true },
      });
      if (existing) catByName.set(name.toLowerCase(), existing.id);
    }
  }

  // Pre-load existing SKUs to decide insert-vs-update.
  const skus = rows.map((r) => r.sku);
  const existingProducts = await ctx.prisma.product.findMany({
    where: { companyId: ctx.companyId, sku: { in: skus } },
    select: { id: true, sku: true },
  });
  const existingBySku = new Map<string, string>(
    existingProducts.map((p) => [p.sku, p.id])
  );

  let created = 0;
  let updated = 0;
  const errors: { sku: string; message: string }[] = [];

  for (const r of rows) {
    const categoryId = r.categoryName
      ? catByName.get(r.categoryName.toLowerCase())
      : undefined;
    const patch = fromProduct({
      name: r.name,
      sku: r.sku,
      barcode: r.barcode,
      categoryId: categoryId ?? "",
      unit: r.unit,
      minStock: r.minStock,
      maxStock: r.maxStock,
      purchasePrice: r.purchasePrice,
      salePrice: r.salePrice,
      description: r.description,
      companyId: ctx.companyId,
    }) as Prisma.ProductUncheckedCreateInput;

    const existingId = existingBySku.get(r.sku);
    try {
      if (existingId) {
        await ctx.prisma.product.update({
          where: { id: existingId },
          data: patch,
        });
        updated++;
      } else {
        await ctx.prisma.product.create({ data: patch });
        created++;
      }
    } catch (e) {
      errors.push({
        sku: r.sku,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return ok({ created, updated, errors });
});

// ============================================
// Account statements (customer / supplier) — xlsx-ready export
// ============================================

const statementSchema = z.object({
  partnerType: z.enum(["customer", "supplier"]),
  partnerId: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export interface StatementRow {
  date: string;
  orderNumber: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export const getPartnerStatement = withCompany<
  z.input<typeof statementSchema>,
  StatementRow[]
>(async (ctx, raw) => {
  const data = parseInput(statementSchema, raw);

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (data.from) dateFilter.gte = new Date(data.from);
  if (data.to) dateFilter.lte = new Date(data.to);

  let orders: {
    orderNumber: string;
    orderDate: Date;
    totalAmount: Prisma.Decimal;
    status: string;
  }[];

  if (data.partnerType === "customer") {
    orders = await ctx.prisma.salesOrder.findMany({
      where: {
        companyId: ctx.companyId,
        customerId: data.partnerId,
        ...(Object.keys(dateFilter).length ? { orderDate: dateFilter } : {}),
      },
      orderBy: { orderDate: "asc" },
      select: {
        orderNumber: true,
        orderDate: true,
        totalAmount: true,
        status: true,
      },
    });
  } else {
    orders = await ctx.prisma.purchaseOrder.findMany({
      where: {
        companyId: ctx.companyId,
        supplierId: data.partnerId,
        ...(Object.keys(dateFilter).length ? { orderDate: dateFilter } : {}),
      },
      orderBy: { orderDate: "asc" },
      select: {
        orderNumber: true,
        orderDate: true,
        totalAmount: true,
        status: true,
      },
    });
  }

  let balance = 0;
  return ok(
    orders.map((o) => {
      const amount = Number(o.totalAmount ?? 0);
      const debit = data.partnerType === "customer" ? amount : 0;
      const credit = data.partnerType === "customer" ? 0 : amount;
      balance += debit - credit;
      return {
        date: o.orderDate.toISOString().slice(0, 10),
        orderNumber: o.orderNumber,
        description: `${o.status} — ${o.orderNumber}`,
        debit,
        credit,
        balance,
      };
    })
  );
});
