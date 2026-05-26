import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  toProduct,
  fromProduct,
  toProductWithStock,
} from "@/lib/mappers/product";

type ProductRow = Prisma.ProductGetPayload<Record<string, never>>;
type SummaryRow = Prisma.ProductStockSummaryGetPayload<Record<string, never>>;

const productRow: ProductRow = {
  id: "p1",
  companyId: "c1",
  categoryId: "cat1",
  name: "Paracetamol",
  sku: "ILC-001",
  barcode: "8690000",
  description: null,
  unit: "kutu",
  minStock: new Prisma.Decimal(10),
  maxStock: new Prisma.Decimal(100),
  purchasePrice: new Prisma.Decimal(12.5),
  salePrice: new Prisma.Decimal(18.9),
  taxRate: new Prisma.Decimal(18),
  weight: null,
  dimensions: null,
  imageUrl: null,
  isPerishable: false,
  defaultExpiryDays: null,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

describe("toProduct", () => {
  it("maps Prisma row to domain Product (numbers, ISO strings)", () => {
    const p = toProduct(productRow);
    expect(p.id).toBe("p1");
    expect(p.sku).toBe("ILC-001");
    expect(p.categoryId).toBe("cat1");
    expect(p.minStock).toBe(10);
    expect(p.purchasePrice).toBe(12.5);
    expect(p.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("nullable fields become undefined, not null", () => {
    const p = toProduct({ ...productRow, barcode: null, imageUrl: null });
    expect(p.barcode).toBeUndefined();
    expect(p.imageUrl).toBeUndefined();
  });

  it("missing categoryId becomes empty string (legacy compat)", () => {
    const p = toProduct({ ...productRow, categoryId: null });
    expect(p.categoryId).toBe("");
  });
});

describe("fromProduct", () => {
  it("camelCase patch becomes Prisma Create input subset", () => {
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
      categoryId: "cat2",
      minStock: 5,
      maxStock: 50,
      purchasePrice: 1,
      salePrice: 2,
      companyId: "c1",
    });
  });

  it("omits undefined keys (partial updates)", () => {
    const out = fromProduct({ name: "Foo" });
    expect(out).toEqual({ name: "Foo" });
  });

  it("empty-string categoryId becomes null", () => {
    const out = fromProduct({ categoryId: "" });
    expect(out.categoryId).toBeNull();
  });

  it("isActive is preserved as boolean", () => {
    expect(fromProduct({ isActive: false }).isActive).toBe(false);
  });
});

describe("toProductWithStock", () => {
  const summaryRow: SummaryRow = {
    productId: "p1",
    companyId: "c1",
    name: "Paracetamol",
    sku: "ILC-001",
    barcode: "8690000",
    categoryId: "cat1",
    categoryName: "İlaçlar",
    unit: "kutu",
    minStock: new Prisma.Decimal(10),
    maxStock: new Prisma.Decimal(100),
    purchasePrice: new Prisma.Decimal(12.5),
    salePrice: new Prisma.Decimal(18.9),
    isActive: true,
    currentStock: new Prisma.Decimal(50),
    reservedStock: new Prisma.Decimal(0),
    stockStatus: "ok",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };

  it("collapses out_of_stock into critical (domain has 4 statuses)", () => {
    const p = toProductWithStock({
      ...summaryRow,
      stockStatus: "out_of_stock",
    });
    expect(p.stockStatus).toBe("critical");
  });

  it("preserves ok/low/critical/overstock", () => {
    for (const s of ["ok", "low", "critical", "overstock"] as const) {
      expect(
        toProductWithStock({ ...summaryRow, stockStatus: s }).stockStatus
      ).toBe(s);
    }
  });
});
