import type { Prisma, Supplier as PrismaSupplier } from "@prisma/client";
import type { Supplier } from "@/lib/types";

type SupplierCreate = Prisma.SupplierUncheckedCreateInput;

export function toSupplier(row: PrismaSupplier, totalOrders = 0, balance = 0): Supplier {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contactPerson ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    taxId: row.taxId ?? undefined,
    balance,
    isActive: row.isActive,
    totalOrders,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
  };
}

export function fromSupplier(
  s: Partial<Supplier> & { companyId?: string; notes?: string }
): Partial<SupplierCreate> {
  const out: Partial<SupplierCreate> = {};
  if (s.companyId !== undefined) out.companyId = s.companyId;
  if (s.name !== undefined) out.name = s.name;
  if (s.contactPerson !== undefined) out.contactPerson = s.contactPerson || null;
  if (s.email !== undefined) out.email = s.email || null;
  if (s.phone !== undefined) out.phone = s.phone || null;
  if (s.address !== undefined) out.address = s.address || null;
  if (s.taxId !== undefined) out.taxId = s.taxId || null;
  if (s.isActive !== undefined) out.isActive = s.isActive;
  if (s.notes !== undefined) out.notes = s.notes || null;
  return out;
}
