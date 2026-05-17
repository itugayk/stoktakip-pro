import { describe, it, expect } from "vitest";
import { toProduct, fromProduct, toProductWithStock } from "@/lib/mappers/product";
import type { Database } from "@/lib/supabase/database.types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type SummaryRow = Database["public"]["Views"]["product_stock_summary"]["Row"];

const productRow: ProductRow = {
  id: "p1",
  company_id: "c1",
  category_id: "cat1",
  name: "Paracetamol",
  sku: "ILC-001",
  barcode: "8690000",
  description: null,
  unit: "kutu",
  min_stock: 10,
  max_stock: 100,
  purchase_price: 12.5,
  sale_price: 18.9,
  tax_rate: 18,
  weight: null,
  dimensions: null,
  image_url: null,
  is_perishable: false,
  default_expiry_days: null,
  is_active: true,
  created_at: "2026-01-01",
  updated_at: "2026-01-02",
};

describe("toProduct", () => {
  it("maps snake_case row to camelCase domain", () => {
    const p = toProduct(productRow);
    expect(p.id).toBe("p1");
    expect(p.sku).toBe("ILC-001");
    expect(p.categoryId).toBe("cat1");
    expect(p.minStock).toBe(10);
    expect(p.purchasePrice).toBe(12.5);
  });

  it("nullable fields become undefined, not null", () => {
    const p = toProduct({ ...productRow, barcode: null, image_url: null });
    expect(p.barcode).toBeUndefined();
    expect(p.imageUrl).toBeUndefined();
  });

  it("missing category_id becomes empty string (legacy compat)", () => {
    const p = toProduct({ ...productRow, category_id: null });
    expect(p.categoryId).toBe("");
  });
});

describe("fromProduct", () => {
  it("camelCase patch becomes snake_case Insert subset", () => {
    const out = fromProduct({
      name: "Foo",
      sku: "X-1",
      categoryId: "cat2",
      minStock: 5,
      maxStock: 50,
      purchasePrice: 1,
      salePrice: 2,
      companyId: "c1",
    });
    expect(out).toMatchObject({
      name: "Foo",
      sku: "X-1",
      category_id: "cat2",
      min_stock: 5,
      max_stock: 50,
      purchase_price: 1,
      sale_price: 2,
      company_id: "c1",
    });
  });

  it("omits undefined keys (partial updates)", () => {
    const out = fromProduct({ name: "Foo" });
    expect(out).toEqual({ name: "Foo" });
  });

  it("empty-string categoryId becomes null", () => {
    const out = fromProduct({ categoryId: "" });
    expect(out.category_id).toBeNull();
  });

  it("isActive maps to is_active boolean", () => {
    expect(fromProduct({ isActive: false }).is_active).toBe(false);
  });
});

describe("toProductWithStock", () => {
  const summaryRow: SummaryRow = {
    product_id: "p1",
    company_id: "c1",
    name: "Paracetamol",
    sku: "ILC-001",
    barcode: "8690000",
    category_id: "cat1",
    category_name: "İlaçlar",
    unit: "kutu",
    min_stock: 10,
    max_stock: 100,
    purchase_price: 12.5,
    sale_price: 18.9,
    is_active: true,
    current_stock: 50,
    reserved_stock: 0,
    stock_status: "ok",
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
  };

  it("collapses out_of_stock into critical (domain has 4 statuses)", () => {
    const p = toProductWithStock({ ...summaryRow, stock_status: "out_of_stock" });
    expect(p.stockStatus).toBe("critical");
  });

  it("preserves ok/low/critical/overstock", () => {
    for (const s of ["ok", "low", "critical", "overstock"] as const) {
      expect(toProductWithStock({ ...summaryRow, stock_status: s }).stockStatus).toBe(s);
    }
  });
});
