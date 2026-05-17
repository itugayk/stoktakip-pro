import type { Database } from "@/lib/supabase/database.types";
import type { Category } from "@/lib/types";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id ?? undefined,
    color: row.color ?? undefined,
    icon: row.icon ?? undefined,
  };
}

export function fromCategory(
  c: Partial<Category> & { companyId?: string }
): Partial<CategoryInsert> {
  const out: Partial<CategoryInsert> = {};
  if (c.companyId !== undefined) out.company_id = c.companyId;
  if (c.name !== undefined) out.name = c.name;
  if (c.parentId !== undefined) out.parent_id = c.parentId || null;
  if (c.color !== undefined) out.color = c.color || null;
  if (c.icon !== undefined) out.icon = c.icon || null;
  return out;
}
