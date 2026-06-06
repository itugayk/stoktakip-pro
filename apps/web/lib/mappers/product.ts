import type { Prisma, Product as PrismaProduct } from "@prisma/client";
import type { Product, ProductWithStock } from "@/lib/types";

type ProductCreate = Prisma.ProductUncheckedCreateInput;

/**
 * Joined view row from product_stock_summary.
 * Defined inline because Prisma's `view` block emits a model type for it.
 */
type ProductSummaryRow = Prisma.ProductStockSummaryGetPayload<Record<string, never>>;

const d = (v: Prisma.Decimal | number | string): number =>
  typeof v === "number" ? v : Number(v);

const iso = (d: Date | string): string =>
  typeof d === "string" ? d : d.toISOString();

export function toProduct(row: PrismaProduct): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode ?? undefined,
    description: row.description ?? undefined,
    categoryId: row.categoryId ?? "",
    unit: row.unit,
    minStock: d(row.minStock),
    maxStock: d(row.maxStock),
    purchasePrice: d(row.purchasePrice),
    salePrice: d(row.salePrice),
    imageUrl: row.imageUrl ?? undefined,
    isActive: row.isActive,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function fromProduct(
  p: Partial<Product> & { companyId?: string; tracksSerial?: boolean }
): Partial<ProductCreate> {
  const out: Partial<ProductCreate> = {};
  if (p.companyId !== undefined) out.companyId = p.companyId;
  if (p.name !== undefined) out.name = p.name;
  if (p.sku !== undefined) out.sku = p.sku;
  if (p.barcode !== undefined) out.barcode = p.barcode || null;
  if (p.description !== undefined) out.description = p.description || null;
  if (p.categoryId !== undefined) out.categoryId = p.categoryId || null;
  if (p.unit !== undefined) out.unit = p.unit;
  if (p.minStock !== undefined) out.minStock = p.minStock;
  if (p.maxStock !== undefined) out.maxStock = p.maxStock;
  if (p.purchasePrice !== undefined) out.purchasePrice = p.purchasePrice;
  if (p.salePrice !== undefined) out.salePrice = p.salePrice;
  if (p.imageUrl !== undefined) out.imageUrl = p.imageUrl || null;
  if (p.isActive !== undefined) out.isActive = p.isActive;
  if (p.tracksSerial !== undefined) out.tracksSerial = p.tracksSerial;
  return out;
}

export function toProductWithStock(row: ProductSummaryRow): ProductWithStock {
  const status =
    row.stockStatus === "out_of_stock" ? "critical" : (row.stockStatus as ProductWithStock["stockStatus"]);
  return {
    id: row.productId,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode ?? undefined,
    description: undefined,
    categoryId: row.categoryId ?? "",
    unit: row.unit,
    minStock: d(row.minStock),
    maxStock: d(row.maxStock),
    purchasePrice: d(row.purchasePrice),
    salePrice: d(row.salePrice),
    isActive: row.isActive,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    currentStock: d(row.currentStock),
    reservedStock: d(row.reservedStock),
    availableStock: d(row.currentStock) - d(row.reservedStock),
    categoryName: row.categoryName ?? "",
    stockStatus: status,
  };
}
