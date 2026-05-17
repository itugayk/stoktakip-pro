import type { Database } from "@/lib/supabase/database.types";
import type { Supplier } from "@/lib/types";

type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];
type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];

export function toSupplier(row: SupplierRow, totalOrders = 0): Supplier {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contact_person ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    taxId: row.tax_id ?? undefined,
    isActive: row.is_active,
    totalOrders,
    createdAt: row.created_at,
  };
}

export function fromSupplier(
  s: Partial<Supplier> & { companyId?: string; notes?: string }
): Partial<SupplierInsert> {
  const out: Partial<SupplierInsert> = {};
  if (s.companyId !== undefined) out.company_id = s.companyId;
  if (s.name !== undefined) out.name = s.name;
  if (s.contactPerson !== undefined) out.contact_person = s.contactPerson || null;
  if (s.email !== undefined) out.email = s.email || null;
  if (s.phone !== undefined) out.phone = s.phone || null;
  if (s.address !== undefined) out.address = s.address || null;
  if (s.taxId !== undefined) out.tax_id = s.taxId || null;
  if (s.isActive !== undefined) out.is_active = s.isActive;
  if (s.notes !== undefined) out.notes = s.notes || null;
  return out;
}
