"use server";

import {
  withAuth,
  withRole,
  ok,
  fail,
  parseInput,
  z,
  ERR,
  logAudit,
} from "@/lib/server";

export type ReturnType = "customer" | "supplier";
export type ReturnStatus =
  | "pending"
  | "approved"
  | "received"
  | "rejected"
  | "cancelled";
export type ReturnItemCondition = "resellable" | "damaged" | "scrap";

export interface Return {
  id: string;
  type: ReturnType;
  status: ReturnStatus;
  warehouseId: string;
  customerId?: string;
  supplierId?: string;
  relatedOrderId?: string;
  reason?: string;
  notes?: string;
  createdAt: string;
  items: {
    id: string;
    productId: string;
    productName?: string;
    quantity: number;
    condition: ReturnItemCondition;
    lotNumber?: string;
    unitValue?: number;
  }[];
}

const createSchema = z.object({
  type: z.enum(["customer", "supplier"]),
  warehouseId: z.string(),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  relatedOrderId: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().positive(),
        condition: z.enum(["resellable", "damaged", "scrap"]),
        lotNumber: z.string().optional(),
        unitValue: z.number().nonnegative().optional(),
      })
    )
    .min(1, "En az bir kalem"),
});

export const createReturn = withAuth<
  z.input<typeof createSchema>,
  { returnId: string }
>(async (ctx, raw) => {
  const data = parseInput(createSchema, raw);

  if (data.type === "customer" && !data.customerId) {
    return fail("validation", "Müşteri iadesi için müşteri seçin", "customerId");
  }
  if (data.type === "supplier" && !data.supplierId) {
    return fail(
      "validation",
      "Tedarikçi iadesi için tedarikçi seçin",
      "supplierId"
    );
  }

  const ret = await ctx.prisma.return.create({
    data: {
      companyId: ctx.companyId,
      type: data.type,
      warehouseId: data.warehouseId,
      customerId: data.customerId ?? null,
      supplierId: data.supplierId ?? null,
      relatedOrderId: data.relatedOrderId ?? null,
      reason: data.reason ?? null,
      notes: data.notes ?? null,
      createdById: ctx.userId,
      items: {
        create: data.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          condition: it.condition,
          lotNumber: it.lotNumber ?? null,
          unitValue: it.unitValue ?? null,
        })),
      },
    },
    select: { id: true },
  });

  await logAudit(ctx, {
    action: "create",
    table: "returns",
    recordId: ret.id,
    newData: data as unknown as Record<string, unknown>,
  });
  return ok({ returnId: ret.id });
});

export const listReturns = withAuth<
  { status?: ReturnStatus } | undefined,
  Return[]
>(async (ctx, filter) => {
  const rows = await ctx.prisma.return.findMany({
    where: {
      companyId: ctx.companyId,
      ...(filter?.status ? { status: filter.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: { product: { select: { name: true } } },
      },
    },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      type: r.type as ReturnType,
      status: r.status as ReturnStatus,
      warehouseId: r.warehouseId,
      customerId: r.customerId ?? undefined,
      supplierId: r.supplierId ?? undefined,
      relatedOrderId: r.relatedOrderId ?? undefined,
      reason: r.reason ?? undefined,
      notes: r.notes ?? undefined,
      createdAt: r.createdAt.toISOString(),
      items: r.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.product?.name,
        quantity: Number(it.quantity),
        condition: it.condition as ReturnItemCondition,
        lotNumber: it.lotNumber ?? undefined,
        unitValue: it.unitValue != null ? Number(it.unitValue) : undefined,
      })),
    }))
  );
});

const idSchema = z.object({ returnId: z.string() });

export const approveReturn = withRole<z.input<typeof idSchema>, void>(
  ["admin", "manager"],
  async (ctx, raw) => {
    const { returnId } = parseInput(idSchema, raw);

    const res = await ctx.prisma.return.updateMany({
      where: { id: returnId, companyId: ctx.companyId, status: "pending" },
      data: {
        status: "approved",
        approvedById: ctx.userId,
        approvedAt: new Date(),
      },
    });
    if (res.count === 0) {
      return fail("invalid_state", "İade onaylanamaz");
    }

    await logAudit(ctx, {
      action: "approve",
      table: "returns",
      recordId: returnId,
    });
    return ok();
  }
);

export const receiveReturn = withAuth<
  z.input<typeof idSchema>,
  { movementsCreated: number }
>(async (ctx, raw) => {
  const { returnId } = parseInput(idSchema, raw);

  const ret = await ctx.prisma.return.findFirst({
    where: { id: returnId, companyId: ctx.companyId },
    select: {
      id: true,
      type: true,
      warehouseId: true,
      companyId: true,
      status: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          condition: true,
          lotNumber: true,
          unitValue: true,
        },
      },
    },
  });
  if (!ret) throw ERR.notFound("İade");
  if (ret.status !== "approved") {
    return fail("invalid_state", "Önce onaylayın");
  }

  const movementsCreated = await ctx.prisma.$transaction(async (tx) => {
    let created = 0;
    for (const it of ret.items) {
      const isCustomer = ret.type === "customer";

      await tx.stockMovement.create({
        data: {
          companyId: ret.companyId,
          productId: it.productId,
          movementType: isCustomer ? "in" : "out",
          quantity: it.quantity,
          fromWarehouseId: isCustomer ? null : ret.warehouseId,
          toWarehouseId: isCustomer ? ret.warehouseId : null,
          lotNumber: it.lotNumber ?? null,
          unitCost: it.unitValue,
          reason: `return_${ret.type}_${it.condition}`,
          referenceType: "return",
          referenceNumber: returnId,
          userId: ctx.userId,
        },
      });
      created++;

      // Customer returns: resellable / damaged also add to inventory; scrap stays out.
      if (isCustomer && it.condition !== "scrap") {
        await tx.inventory.create({
          data: {
            companyId: ret.companyId,
            productId: it.productId,
            warehouseId: ret.warehouseId,
            lotNumber: it.lotNumber ?? null,
            quantity: it.quantity,
            unitCost: it.unitValue ?? 0,
          },
        });
      }
    }

    await tx.return.update({
      where: { id: returnId },
      data: { status: "received" },
    });

    return created;
  });

  await logAudit(ctx, {
    action: "update",
    table: "returns",
    recordId: returnId,
    newData: { status: "received", movements: movementsCreated },
  });

  return ok({ movementsCreated });
});
