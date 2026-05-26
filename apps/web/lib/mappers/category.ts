import type { Prisma, Category as PrismaCategory } from "@prisma/client";
import type { Category } from "@/lib/types";

type CategoryCreate = Prisma.CategoryUncheckedCreateInput;

export function toCategory(row: PrismaCategory): Category {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId ?? undefined,
    color: row.color ?? undefined,
    icon: row.icon ?? undefined,
  };
}

export function fromCategory(
  c: Partial<Category> & { companyId?: string }
): Partial<CategoryCreate> {
  const out: Partial<CategoryCreate> = {};
  if (c.companyId !== undefined) out.companyId = c.companyId;
  if (c.name !== undefined) out.name = c.name;
  if (c.parentId !== undefined) out.parentId = c.parentId || null;
  if (c.color !== undefined) out.color = c.color || null;
  if (c.icon !== undefined) out.icon = c.icon || null;
  return out;
}
