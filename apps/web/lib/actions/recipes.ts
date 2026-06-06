"use server";

import { withCompany, ok, fail, parseInput, z, ERR, logAudit } from "@/lib/server";
import { applyStockMovement, allowNegativeStock } from "@/lib/inventory/engine";
import { assertModuleEnabled } from "@/lib/modules/guard";

export interface RecipeRow {
  id: string;
  name: string;
  productId: string;
  productName: string;
  yieldQty: number;
  isActive: boolean;
  itemCount: number;
}

export interface RecipeDetail extends RecipeRow {
  items: {
    id: string;
    componentProductId: string;
    componentName: string;
    quantity: number;
  }[];
}

export const listRecipes = withCompany<void, RecipeRow[]>(async (ctx) => {
  await assertModuleEnabled(ctx, "recipes");
  const rows = await ctx.prisma.recipe.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
  return ok(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      productId: r.productId,
      productName: r.product?.name ?? "—",
      yieldQty: Number(r.yieldQty),
      isActive: r.isActive,
      itemCount: r._count.items,
    }))
  );
});

export const getRecipe = withCompany<string, RecipeDetail | null>(
  async (ctx, recipeId) => {
    await assertModuleEnabled(ctx, "recipes");
    const r = await ctx.prisma.recipe.findFirst({
      where: { id: recipeId, companyId: ctx.companyId },
      include: {
        product: { select: { name: true } },
        items: { include: { componentProduct: { select: { name: true } } } },
      },
    });
    if (!r) return ok(null);
    return ok({
      id: r.id,
      name: r.name,
      productId: r.productId,
      productName: r.product?.name ?? "—",
      yieldQty: Number(r.yieldQty),
      isActive: r.isActive,
      itemCount: r.items.length,
      items: r.items.map((it) => ({
        id: it.id,
        componentProductId: it.componentProductId,
        componentName: it.componentProduct?.name ?? "—",
        quantity: Number(it.quantity),
      })),
    });
  }
);

const upsertSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, "Üretilen ürünü seçin"),
  name: z.string().min(1, "Reçete adı zorunlu"),
  yieldQty: z.number().positive().default(1),
  items: z
    .array(
      z.object({
        componentProductId: z.string(),
        quantity: z.number().positive(),
      })
    )
    .min(1, "En az bir bileşen ekleyin"),
});

export const upsertRecipe = withCompany<
  z.input<typeof upsertSchema>,
  { recipeId: string }
>(async (ctx, raw) => {
  await assertModuleEnabled(ctx, "recipes");
  const data = parseInput(upsertSchema, raw);

  // Validate all referenced products belong to the company.
  const ids = [data.productId, ...data.items.map((i) => i.componentProductId)];
  const valid = await ctx.prisma.product.count({
    where: { companyId: ctx.companyId, id: { in: ids } },
  });
  if (valid !== new Set(ids).size) throw ERR.notFound("Ürün");

  const recipeId = await ctx.prisma.$transaction(async (tx) => {
    if (data.id) {
      await tx.recipe.update({
        where: { id: data.id },
        data: { productId: data.productId, name: data.name, yieldQty: data.yieldQty },
      });
      await tx.recipeItem.deleteMany({ where: { recipeId: data.id } });
      await tx.recipeItem.createMany({
        data: data.items.map((i) => ({
          recipeId: data.id!,
          componentProductId: i.componentProductId,
          quantity: i.quantity,
        })),
      });
      return data.id;
    }
    const created = await tx.recipe.create({
      data: {
        companyId: ctx.companyId,
        productId: data.productId,
        name: data.name,
        yieldQty: data.yieldQty,
        items: {
          create: data.items.map((i) => ({
            componentProductId: i.componentProductId,
            quantity: i.quantity,
          })),
        },
      },
      select: { id: true },
    });
    return created.id;
  });

  await logAudit(ctx, {
    action: data.id ? "update" : "create",
    table: "recipes",
    recordId: recipeId,
  });
  return ok({ recipeId });
});

export const deleteRecipe = withCompany<string, void>(async (ctx, recipeId) => {
  await assertModuleEnabled(ctx, "recipes");
  const res = await ctx.prisma.recipe.deleteMany({
    where: { id: recipeId, companyId: ctx.companyId },
  });
  if (res.count === 0) throw ERR.notFound("Reçete");
  return ok();
});

const produceSchema = z.object({
  recipeId: z.string(),
  /** Finished units to produce. */
  quantity: z.number().positive("Miktar 0'dan büyük olmalı"),
  warehouseId: z.string().min(1, "Depo seçin"),
});

/**
 * Produce a recipe: consume each component (FEFO out) and add the finished
 * product (in), atomically. Components scale by quantity / yieldQty. If any
 * component is short on stock, the whole production rolls back.
 */
export const produceRecipe = withCompany<
  z.input<typeof produceSchema>,
  { produced: number }
>(async (ctx, raw) => {
  await assertModuleEnabled(ctx, "recipes");
  const data = parseInput(produceSchema, raw);

  const recipe = await ctx.prisma.recipe.findFirst({
    where: { id: data.recipeId, companyId: ctx.companyId },
    select: {
      id: true,
      productId: true,
      yieldQty: true,
      isActive: true,
      items: { select: { componentProductId: true, quantity: true } },
    },
  });
  if (!recipe) throw ERR.notFound("Reçete");
  if (!recipe.isActive) return fail("invalid_state", "Reçete pasif");
  if (recipe.items.length === 0) return fail("invalid_state", "Reçetede bileşen yok");

  const runs = data.quantity / Number(recipe.yieldQty);

  await ctx.prisma.$transaction(async (tx) => {
    const allowNegative = await allowNegativeStock(tx, ctx.companyId);
    // Consume components (FEFO). Throws InsufficientStockError if short.
    for (const item of recipe.items) {
      await applyStockMovement(tx, {
        companyId: ctx.companyId,
        productId: item.componentProductId,
        movementType: "out",
        quantity: Number(item.quantity) * runs,
        fromWarehouseId: data.warehouseId,
        reason: "recipe_production_consume",
        referenceType: "recipe",
        referenceNumber: recipe.id,
        userId: ctx.userId,
        allowNegative,
      });
    }
    // Add the finished product.
    await applyStockMovement(tx, {
      companyId: ctx.companyId,
      productId: recipe.productId,
      movementType: "in",
      quantity: data.quantity,
      toWarehouseId: data.warehouseId,
      reason: "recipe_production_yield",
      referenceType: "recipe",
      referenceNumber: recipe.id,
      userId: ctx.userId,
    });
  });

  await logAudit(ctx, {
    action: "create",
    table: "recipes",
    recordId: recipe.id,
    newData: { produced: data.quantity, warehouseId: data.warehouseId },
  });
  return ok({ produced: data.quantity });
});
