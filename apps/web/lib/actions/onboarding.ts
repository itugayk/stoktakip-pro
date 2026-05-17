"use server";

import { withCompany, ok, parseInput, z, ERR } from "@/lib/server";
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
 * Single atomic-ish onboarding step: writes company settings, the first
 * warehouse, categories, and seed products. Real DB ops happen sequentially —
 * if a later step fails, earlier rows remain and the user can re-run.
 */
export const completeOnboarding = withCompany<
  z.input<typeof onboardingSchema>,
  { warehouseId?: string; categoryCount: number; productCount: number }
>(async (ctx, raw) => {
  const data = parseInput(onboardingSchema, raw);
  if (ctx.demo) {
    return ok({
      warehouseId: "wh-demo",
      categoryCount: data.categories.length,
      productCount: data.products.length,
    });
  }

  // 1) Company settings + name/tax/phone/address + onboarding marker
  const { error: companyErr } = await ctx.supabase
    .from("companies")
    .update({
      name: data.company.name,
      tax_id: data.company.taxId || null,
      phone: data.company.phone || null,
      address: data.company.address || null,
      logo_url: data.company.logoUrl || null,
      settings: { onboarding_completed_at: new Date().toISOString() },
    })
    .eq("id", ctx.companyId);
  if (companyErr) throw ERR.database(companyErr.message);

  // 2) First warehouse
  const whInsert = fromWarehouse({ ...data.warehouse, companyId: ctx.companyId });
  const { data: wh, error: whErr } = await ctx.supabase
    .from("warehouses")
    .insert(whInsert as never)
    .select("id")
    .single();
  if (whErr) throw ERR.database(whErr.message);

  // 3) Categories (skip duplicates by name)
  let categoryCount = 0;
  const categoryIdByName = new Map<string, string>();
  for (const c of data.categories) {
    const ins = fromCategory({ ...c, companyId: ctx.companyId });
    const { data: row, error } = await ctx.supabase
      .from("categories")
      .insert(ins as never)
      .select("id")
      .single();
    if (!error && row) {
      categoryIdByName.set(c.name, row.id);
      categoryCount++;
    }
  }

  // 4) Seed products (use first category if not specified)
  const firstCategoryId = categoryIdByName.values().next().value;
  let productCount = 0;
  for (const p of data.products) {
    const ins = fromProduct({
      ...p,
      companyId: ctx.companyId,
      categoryId: firstCategoryId,
    });
    const { error } = await ctx.supabase.from("products").insert(ins as never);
    if (!error) productCount++;
  }

  return ok({ warehouseId: wh.id, categoryCount, productCount });
});

/**
 * Check whether onboarding has already been completed. The dashboard layout
 * can call this on first paint to redirect new users.
 */
export const getOnboardingStatus = withCompany<void, { completed: boolean; completedAt?: string }>(
  async (ctx) => {
    if (ctx.demo) return ok({ completed: true });
    const { data, error } = await ctx.supabase
      .from("companies")
      .select("settings")
      .eq("id", ctx.companyId)
      .single();
    if (error) throw ERR.database(error.message);
    const settings = (data?.settings ?? {}) as { onboarding_completed_at?: string };
    return ok({
      completed: Boolean(settings.onboarding_completed_at),
      completedAt: settings.onboarding_completed_at,
    });
  }
);
