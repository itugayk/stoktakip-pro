"use server";

import type { Prisma } from "@prisma/client";
import { withCompany, ok, parseInput, z } from "@/lib/server";
import { fromCategory, fromProduct, fromWarehouse } from "@/lib/mappers";

const onboardingSchema = z.object({
  company: z.object({
    name: z.string().min(1, "Şirket adı zorunlu"),
    taxId: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    logoUrl: z.string().url().optional().or(z.literal("")),
  }),
  warehouse: z.object({
    name: z.string().min(1, "Depo adı zorunlu"),
    address: z.string().optional(),
  }),
  categories: z
    .array(
      z.object({
        name: z.string().min(1),
        icon: z.string().optional(),
        color: z.string().optional(),
      })
    )
    .max(20),
  products: z
    .array(
      z.object({
        name: z.string().min(1),
        sku: z.string().min(1),
        unit: z.string().default("adet"),
        purchasePrice: z.number().nonnegative().default(0),
        salePrice: z.number().nonnegative().default(0),
        minStock: z.number().nonnegative().default(0),
        maxStock: z.number().nonnegative().default(0),
      })
    )
    .max(50),
});

/**
 * Atomic onboarding step: writes company settings, the first warehouse,
 * categories, and seed products. All inside a transaction so a failure rolls
 * everything back.
 */
export const completeOnboarding = withCompany<
  z.input<typeof onboardingSchema>,
  { warehouseId: string; categoryCount: number; productCount: number }
>(async (ctx, raw) => {
  const data = parseInput(onboardingSchema, raw);

  const result = await ctx.prisma.$transaction(async (tx) => {
    // 1) Company settings + onboarding marker
    await tx.company.update({
      where: { id: ctx.companyId },
      data: {
        name: data.company.name,
        taxId: data.company.taxId || null,
        phone: data.company.phone || null,
        address: data.company.address || null,
        logoUrl: data.company.logoUrl || null,
        settings: { onboarding_completed_at: new Date().toISOString() },
      },
    });

    // 2) First warehouse
    const whInsert = fromWarehouse({
      ...data.warehouse,
      companyId: ctx.companyId,
    }) as Prisma.WarehouseUncheckedCreateInput;
    const wh = await tx.warehouse.create({
      data: whInsert,
      select: { id: true },
    });

    // 3) Categories (skip duplicates by name).
    let categoryCount = 0;
    const categoryIdByName = new Map<string, string>();
    for (const c of data.categories) {
      try {
        const ins = fromCategory({
          ...c,
          companyId: ctx.companyId,
        }) as Prisma.CategoryUncheckedCreateInput;
        const row = await tx.category.create({
          data: ins,
          select: { id: true },
        });
        categoryIdByName.set(c.name, row.id);
        categoryCount++;
      } catch {
        // Duplicate name – skip.
      }
    }

    // 4) Seed products (use first category if not specified).
    const firstCategoryId = categoryIdByName.values().next().value as
      | string
      | undefined;
    let productCount = 0;
    for (const p of data.products) {
      try {
        const ins = fromProduct({
          ...p,
          companyId: ctx.companyId,
          categoryId: firstCategoryId,
        }) as Prisma.ProductUncheckedCreateInput;
        await tx.product.create({ data: ins });
        productCount++;
      } catch {
        // Duplicate SKU – skip.
      }
    }

    return { warehouseId: wh.id, categoryCount, productCount };
  });

  return ok(result);
});

/**
 * Check whether onboarding has already been completed. The dashboard layout
 * can call this on first paint to redirect new users.
 */
export const getOnboardingStatus = withCompany<
  void,
  { completed: boolean; completedAt?: string }
>(async (ctx) => {
  const company = await ctx.prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: { settings: true },
  });
  const settings = ((company?.settings ?? {}) as {
    onboarding_completed_at?: string;
  });
  return ok({
    completed: Boolean(settings.onboarding_completed_at),
    completedAt: settings.onboarding_completed_at,
  });
});
