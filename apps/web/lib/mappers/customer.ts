import type { Database } from "@/lib/supabase/database.types";
import type { Customer } from "@/lib/types";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];

export function toCustomer(row: CustomerRow, totalOrders = 0): Customer {
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

export function fromCustomer(
  c: Partial<Customer> & { companyId?: string; notes?: string }
): Partial<CustomerInsert> {
  const out: Partial<CustomerInsert> = {};
  if (c.companyId !== undefined) out.company_id = c.companyId;
  if (c.name !== undefined) out.name = c.name;
  if (c.contactPerson !== undefined) out.contact_person = c.contactPerson || null;
  if (c.email !== undefined) out.email = c.email || null;
  if (c.phone !== undefined) out.phone = c.phone || null;
  if (c.address !== undefined) out.address = c.address || null;
  if (c.taxId !== undefined) out.tax_id = c.taxId || null;
  if (c.isActive !== undefined) out.is_active = c.isActive;
  if (c.notes !== undefined) out.notes = c.notes || null;
  return out;
}
