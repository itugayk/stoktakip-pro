import type { Database } from "@/lib/supabase/database.types";
import type { Product, ProductWithStock } from "@/lib/types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductSummaryRow = Database["public"]["Views"]["product_stock_summary"]["Row"];

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode ?? undefined,
    description: row.description ?? undefined,
    categoryId: row.category_id ?? "",
    unit: row.unit,
    minStock: row.min_stock,
    maxStock: row.max_stock,
    purchasePrice: row.purchase_price,
    salePrice: row.sale_price,
    imageUrl: row.image_url ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function fromProduct(
  p: Partial<Product> & { companyId?: string }
): Partial<ProductInsert> {
  const out: Partial<ProductInsert> = {};
  if (p.companyId !== undefined) out.company_id = p.companyId;
  if (p.name !== undefined) out.name = p.name;
  if (p.sku !== undefined) out.sku = p.sku;
  if (p.barcode !== undefined) out.barcode = p.barcode || null;
  if (p.description !== undefined) out.description = p.description || null;
  if (p.categoryId !== undefined) out.category_id = p.categoryId || null;
  if (p.unit !== undefined) out.unit = p.unit;
  if (p.minStock !== undefined) out.min_stock = p.minStock;
  if (p.maxStock !== undefined) out.max_stock = p.maxStock;
  if (p.purchasePrice !== undefined) out.purchase_price = p.purchasePrice;
  if (p.salePrice !== undefined) out.sale_price = p.salePrice;
  if (p.imageUrl !== undefined) out.image_url = p.imageUrl || null;
  if (p.isActive !== undefined) out.is_active = p.isActive;
  return out;
}

export function toProductWithStock(row: ProductSummaryRow): ProductWithStock {
  const status = row.stock_status === "out_of_stock" ? "critical" : row.stock_status;
  return {
    id: row.product_id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode ?? undefined,
    description: undefined,
    categoryId: row.category_id ?? "",
    unit: row.unit,
    minStock: row.min_stock,
    maxStock: row.max_stock,
    purchasePrice: row.purchase_price,
    salePrice: row.sale_price,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentStock: row.current_stock,
    categoryName: row.category_name ?? "",
    stockStatus: status,
  };
}
