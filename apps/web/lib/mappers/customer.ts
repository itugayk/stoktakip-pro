import type { Prisma, Customer as PrismaCustomer } from "@prisma/client";
import type { Customer } from "@/lib/types";

type CustomerCreate = Prisma.CustomerUncheckedCreateInput;

export function toCustomer(row: PrismaCustomer, totalOrders = 0): Customer {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contactPerson ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    taxId: row.taxId ?? undefined,
    isActive: row.isActive,
    totalOrders,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
  };
}

export function fromCustomer(
  c: Partial<Customer> & { companyId?: string; notes?: string }
): Partial<CustomerCreate> {
  const out: Partial<CustomerCreate> = {};
  if (c.companyId !== undefined) out.companyId = c.companyId;
  if (c.name !== undefined) out.name = c.name;
  if (c.contactPerson !== undefined) out.contactPerson = c.contactPerson || null;
  if (c.email !== undefined) out.email = c.email || null;
  if (c.phone !== undefined) out.phone = c.phone || null;
  if (c.address !== undefined) out.address = c.address || null;
  if (c.taxId !== undefined) out.taxId = c.taxId || null;
  if (c.isActive !== undefined) out.isActive = c.isActive;
  if (c.notes !== undefined) out.notes = c.notes || null;
  return out;
}
