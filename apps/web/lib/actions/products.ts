"use server";

import type { Prisma } from "@prisma/client";
import type { ProductWithStock, Category } from "@/lib/types";
import {
  toProductWithStock,
  fromProduct,
  toCategory,
  fromCategory,
} from "@/lib/mappers";
import {
  withAuth,
  withCompany,
  ok,
  parseInput,
  z,
  ERR,
  logAudit,
} from "@/lib/server";
import { fireWebhookEvent } from "@/lib/webhooks/dispatch";
import { assertWithinLimit } from "@/lib/billing/enforce";

// ============================================
// GET PRODUCTS (with stock summary)
// ============================================
export const getProducts = withAuth<
  { search?: string; categoryId?: string; status?: string } | undefined,
  ProductWithStock[]
>(async (ctx, filters) => {
  const where: Prisma.ProductStockSummaryWhereInput = {
    companyId: ctx.companyId,
  };
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { sku: { contains: filters.search, mode: "insensitive" } },
      { barcode: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters?.categoryId && filters.categoryId !== "all") {
    where.categoryId = filters.categoryId;
  }
  if (filters?.status && filters.status !== "all") {
    where.stockStatus = filters.status;
  }

  const rows = await ctx.prisma.productStockSummary.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return ok(rows.map(toProductWithStock));
});

// ============================================
// CREATE PRODUCT
// ============================================
// Empty string OR a real UUID — UI sometimes passes "" when no category picked.
const uuidOrEmpty = z
  .string()
  .refine(
    (v) =>
      v === "" ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
    { message: "Geçerli bir kategori seçin" }
  )
  .optional();

const productInputSchema = z.object({
  name: z.string().min(1, "Ürün adı zorunlu"),
  sku: z.string().min(1, "SKU zorunlu"),
  barcode: z.string().optional(),
  categoryId: uuidOrEmpty,
  unit: z.string().min(1),
  minStock: z.number().nonnegative(),
  maxStock: z.number().nonnegative(),
  purchasePrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative(),
  description: z.string().optional(),
  tracksSerial: z.boolean().optional(),
});

export const createProduct = withCompany<
  z.input<typeof productInputSchema>,
  void
>(async (ctx, raw) => {
  const data = parseInput(productInputSchema, raw);
  await assertWithinLimit(ctx, "products");

  const insert = fromProduct({
    ...data,
    companyId: ctx.companyId,
  }) as Prisma.ProductUncheckedCreateInput;

  const row = await ctx.prisma.product.create({
    data: insert,
    select: { id: true },
  });

  await logAudit(ctx, {
    action: "create",
    table: "products",
    recordId: row.id,
    newData: data as unknown as Record<string, unknown>,
  });
  void fireWebhookEvent(ctx.companyId, "product.created", {
    productId: row.id,
    ...data,
  });
  return ok();
});

// ============================================
// UPDATE PRODUCT
// ============================================
const productUpdateSchema = z.object({
  id: z.string(),
  patch: z
    .object({
      name: z.string().optional(),
      sku: z.string().optional(),
      barcode: z.string().optional(),
      categoryId: uuidOrEmpty,
      unit: z.string().optional(),
      minStock: z.number().optional(),
      maxStock: z.number().optional(),
      purchasePrice: z.number().optional(),
      salePrice: z.number().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
      tracksSerial: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, {
      message: "Güncellenecek alan yok",
    }),
});

export const updateProduct = withCompany<
  z.input<typeof productUpdateSchema>,
  void
>(async (ctx, raw) => {
  const { id, patch } = parseInput(productUpdateSchema, raw);

  const before = await ctx.prisma.product.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!before) throw ERR.notFound("Ürün");

  const update = fromProduct(patch);
  await ctx.prisma.product.update({
    where: { id },
    data: update as Prisma.ProductUpdateInput,
  });

  await logAudit(ctx, {
    action: "update",
    table: "products",
    recordId: id,
    oldData: before as unknown as Record<string, unknown>,
    newData: update as Record<string, unknown>,
  });
  void fireWebhookEvent(ctx.companyId, "product.updated", {
    productId: id,
    changes: patch,
  });
  return ok();
});

// ============================================
// DELETE PRODUCT
// ============================================
export const deleteProduct = withCompany<string, void>(async (ctx, id) => {
  const before = await ctx.prisma.product.findFirst({
    where: { id, companyId: ctx.companyId },
  });
  if (!before) throw ERR.notFound("Ürün");

  await ctx.prisma.product.delete({ where: { id } });

  await logAudit(ctx, {
    action: "delete",
    table: "products",
    recordId: id,
    oldData: before as unknown as Record<string, unknown>,
  });
  void fireWebhookEvent(ctx.companyId, "product.deleted", { productId: id });
  return ok();
});

// ============================================
// GET CATEGORIES
// ============================================
export const getCategories = withAuth<void, Category[]>(async (ctx) => {
  const rows = await ctx.prisma.category.findMany({
    where: { companyId: ctx.companyId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return ok(rows.map(toCategory));
});

// ============================================
// CREATE CATEGORY
// ============================================
const categoryInputSchema = z.object({
  name: z.string().min(1, "Kategori adı zorunlu"),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const createCategory = withCompany<
  z.input<typeof categoryInputSchema>,
  { id: string }
>(async (ctx, raw) => {
  const data = parseInput(categoryInputSchema, raw);

  const insert = fromCategory({
    ...data,
    companyId: ctx.companyId,
  }) as Prisma.CategoryUncheckedCreateInput;

  const row = await ctx.prisma.category.create({
    data: insert,
    select: { id: true },
  });
  return ok({ id: row.id });
});

// ============================================
// UPDATE CATEGORY
// ============================================
const categoryUpdateSchema = z.object({
  id: z.string(),
  patch: z
    .object({
      name: z.string().optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, {
      message: "Güncellenecek alan yok",
    }),
});

export const updateCategory = withCompany<
  z.input<typeof categoryUpdateSchema>,
  void
>(async (ctx, raw) => {
  const { id, patch } = parseInput(categoryUpdateSchema, raw);
  // Verify ownership before update
  const exists = await ctx.prisma.category.findFirst({
    where: { id, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!exists) throw ERR.notFound("Kategori");

  const update = fromCategory(patch);
  await ctx.prisma.category.update({
    where: { id },
    data: update as Prisma.CategoryUpdateInput,
  });
  return ok();
});

// ============================================
// DELETE CATEGORY (soft-delete: is_active = false)
// ============================================
export const deleteCategory = withCompany<string, void>(async (ctx, id) => {
  const exists = await ctx.prisma.category.findFirst({
    where: { id, companyId: ctx.companyId },
    select: { id: true },
  });
  if (!exists) throw ERR.notFound("Kategori");

  await ctx.prisma.category.update({
    where: { id },
    data: { isActive: false },
  });
  return ok();
});

// ============================================
// BULK OPERATIONS
// ============================================
const bulkIdsSchema = z.object({
  ids: z.array(z.string()).min(1, "En az bir ürün seçin"),
});

const bulkPatchSchema = z.object({
  ids: z.array(z.string()).min(1, "En az bir ürün seçin"),
  patch: z
    .object({
      categoryId: z.string().optional(),
      isActive: z.boolean().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: "Boş güncelleme" }),
});

const bulkPriceSchema = z.object({
  ids: z.array(z.string()).min(1, "En az bir ürün seçin"),
  op: z.object({
    type: z.enum(["percent", "fixed"]),
    /** + raise, - reduce. For percent: 10 = +10%, -5 = -5%. */
    value: z.number(),
    /** Which price field to mutate. Defaults to sale price. */
    field: z.enum(["sale_price", "purchase_price"]).optional(),
  }),
});

export const bulkUpdateProducts = withCompany<
  z.input<typeof bulkPatchSchema>,
  { updated: number }
>(async (ctx, raw) => {
  const { ids, patch } = parseInput(bulkPatchSchema, raw);
  const update = fromProduct(patch);

  const res = await ctx.prisma.product.updateMany({
    where: { id: { in: ids }, companyId: ctx.companyId },
    data: update as Prisma.ProductUpdateManyMutationInput,
  });
  return ok({ updated: res.count });
});

export const bulkDeleteProducts = withCompany<
  z.input<typeof bulkIdsSchema>,
  { deleted: number }
>(async (ctx, raw) => {
  const { ids } = parseInput(bulkIdsSchema, raw);

  const res = await ctx.prisma.product.deleteMany({
    where: { id: { in: ids }, companyId: ctx.companyId },
  });
  return ok({ deleted: res.count });
});

export const bulkPriceUpdate = withCompany<
  z.input<typeof bulkPriceSchema>,
  { updated: number }
>(async (ctx, raw) => {
  const { ids, op } = parseInput(bulkPriceSchema, raw);
  // Map snake_case input to camelCase Prisma field.
  const field: "salePrice" | "purchasePrice" =
    op.field === "purchase_price" ? "purchasePrice" : "salePrice";

  // Read current values (company-scoped) then write updated ones in a tx.
  const current = await ctx.prisma.product.findMany({
    where: { id: { in: ids }, companyId: ctx.companyId },
    select: { id: true, [field]: true } as Prisma.ProductSelect,
  });

  let updated = 0;
  await ctx.prisma.$transaction(async (tx) => {
    for (const row of current) {
      const baseRaw = (row as unknown as Record<string, unknown>)[field];
      const base = typeof baseRaw === "number" ? baseRaw : Number(baseRaw ?? 0);
      const next =
        op.type === "percent" ? base * (1 + op.value / 100) : base + op.value;
      const rounded = Math.max(0, Math.round(next * 100) / 100);
      const res = await tx.product.updateMany({
        where: { id: row.id, companyId: ctx.companyId },
        data: { [field]: rounded } as Prisma.ProductUpdateManyMutationInput,
      });
      updated += res.count;
    }
  });
  return ok({ updated });
});

// ============================================
// LOOKUP PRODUCT BY BARCODE
// ============================================
export interface BarcodeLookupResult {
  found: boolean;
  product?: { name: string; sku: string; currentStock: number; unit: string };
}

export const lookupBarcode = withAuth<string, BarcodeLookupResult>(
  async (ctx, code) => {
    const row = await ctx.prisma.productStockSummary.findFirst({
      where: {
        companyId: ctx.companyId,
        OR: [
          { barcode: code },
          { sku: { equals: code, mode: "insensitive" } },
        ],
      },
      select: { name: true, sku: true, currentStock: true, unit: true },
    });

    if (!row) return ok({ found: false });
    return ok({
      found: true,
      product: {
        name: row.name,
        sku: row.sku,
        currentStock: Number(row.currentStock),
        unit: row.unit,
      },
    });
  }
);
