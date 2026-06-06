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
import {
  applyStockMovement,
  allowNegativeStock,
  reserveFEFO,
  releaseReservation,
} from "@/lib/inventory/engine";
import { assertModuleEnabled } from "@/lib/modules/guard";

export type POStatus =
  | "draft"
  | "pending"
  | "approved"
  | "received"
  | "partial"
  | "cancelled";
export type SOStatus =
  | "draft"
  | "pending"
  | "approved"
  | "shipped"
  | "delivered"
  | "cancelled";

// ============================================
// 4.1 — PURCHASE ORDER STATE MACHINE
// ============================================

const idSchema = z.object({ orderId: z.string() });
const rejectSchema = z.object({
  orderId: z.string(),
  reason: z.string().min(1, "Red sebebi gerekli"),
});

export const submitForApproval = withAuth<z.input<typeof idSchema>, void>(
  async (ctx, raw) => {
    const { orderId } = parseInput(idSchema, raw);

    const before = await ctx.prisma.purchaseOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId },
      select: { status: true, totalAmount: true },
    });
    if (!before) throw ERR.notFound("Sipariş");
    if (before.status !== "draft") {
      return fail(
        "invalid_state",
        "Sadece draft siparişler onaya gönderilebilir"
      );
    }

    await ctx.prisma.purchaseOrder.update({
      where: { id: orderId },
      data: { status: "pending" },
    });

    await logAudit(ctx, {
      action: "update",
      table: "purchase_orders",
      recordId: orderId,
      oldData: { status: "draft" },
      newData: { status: "pending" },
    });
    return ok();
  }
);

/** Approve a PO. Restricted to admin + manager. */
export const approveOrder = withRole<z.input<typeof idSchema>, void>(
  ["admin", "manager"],
  async (ctx, raw) => {
    const { orderId } = parseInput(idSchema, raw);

    const before = await ctx.prisma.purchaseOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId },
      select: { status: true, totalAmount: true, companyId: true },
    });
    if (!before) throw ERR.notFound("Sipariş");
    if (before.status !== "pending") {
      return fail(
        "invalid_state",
        "Sadece onay bekleyen siparişler onaylanabilir"
      );
    }

    // Manager-only threshold check.
    if (ctx.role === "manager") {
      const company = await ctx.prisma.company.findUnique({
        where: { id: before.companyId },
        select: { settings: true },
      });
      const threshold = (company?.settings as { po_approval_threshold?: number } | null)
        ?.po_approval_threshold;
      if (typeof threshold === "number" && Number(before.totalAmount) > threshold) {
        return fail(
          "threshold_exceeded",
          `Bu tutar (${before.totalAmount}₺) manager onay limitini (${threshold}₺) aşıyor`
        );
      }
    }

    await ctx.prisma.purchaseOrder.update({
      where: { id: orderId },
      data: { status: "approved" },
    });

    await logAudit(ctx, {
      action: "approve",
      table: "purchase_orders",
      recordId: orderId,
      oldData: { status: "pending" },
      newData: { status: "approved" },
    });
    return ok();
  }
);

export const rejectOrder = withRole<z.input<typeof rejectSchema>, void>(
  ["admin", "manager"],
  async (ctx, raw) => {
    const { orderId, reason } = parseInput(rejectSchema, raw);

    const before = await ctx.prisma.purchaseOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId },
      select: { status: true, notes: true },
    });
    if (!before) throw ERR.notFound("Sipariş");
    if (before.status !== "pending") {
      return fail(
        "invalid_state",
        "Sadece onay bekleyen siparişler reddedilebilir"
      );
    }

    const notesAppendix = `\n[RED ${new Date()
      .toISOString()
      .slice(0, 10)}] ${reason}`;

    await ctx.prisma.purchaseOrder.update({
      where: { id: orderId },
      data: {
        status: "cancelled",
        notes: (before.notes ?? "") + notesAppendix,
      },
    });

    await logAudit(ctx, {
      action: "reject",
      table: "purchase_orders",
      recordId: orderId,
      oldData: { status: "pending" },
      newData: { status: "cancelled", reason },
    });
    return ok();
  }
);

export const cancelOrder = withAuth<z.input<typeof idSchema>, void>(
  async (ctx, raw) => {
    const { orderId } = parseInput(idSchema, raw);

    const res = await ctx.prisma.purchaseOrder.updateMany({
      where: {
        id: orderId,
        companyId: ctx.companyId,
        status: { in: ["draft", "pending"] },
      },
      data: { status: "cancelled" },
    });

    if (res.count === 0) {
      return fail("invalid_state", "Sipariş iptal edilemez veya bulunamadı");
    }

    await logAudit(ctx, {
      action: "update",
      table: "purchase_orders",
      recordId: orderId,
      newData: { status: "cancelled" },
    });
    return ok();
  }
);

// ============================================
// 4.2 — PURCHASE ORDER RECEIVING
// ============================================

export interface ReceivableLine {
  itemId: string;
  productId: string;
  productName: string;
  productSku: string;
  productBarcode?: string;
  ordered: number;
  alreadyReceived: number;
  unitPrice: number;
}

export interface ReceivablePO {
  orderNumber: string;
  lines: ReceivableLine[];
}

/** Server-side loader for the mal-kabul page. */
export const getPurchaseOrderForReceiving = withAuth<
  string,
  ReceivablePO | null
>(async (ctx, orderId) => {
  const order = await ctx.prisma.purchaseOrder.findFirst({
    where: { id: orderId, companyId: ctx.companyId },
    select: {
      orderNumber: true,
      items: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          receivedQuantity: true,
          unitPrice: true,
          product: { select: { name: true, sku: true, barcode: true } },
        },
      },
    },
  });
  if (!order) return ok(null);

  return ok({
    orderNumber: order.orderNumber,
    lines: order.items.map((it) => ({
      itemId: it.id,
      productId: it.productId,
      productName: it.product?.name ?? "Bilinmeyen",
      productSku: it.product?.sku ?? "",
      productBarcode: it.product?.barcode ?? undefined,
      ordered: Number(it.quantity),
      alreadyReceived: Number(it.receivedQuantity ?? 0),
      unitPrice: Number(it.unitPrice),
    })),
  });
});

export interface PickableLine {
  itemId: string;
  productId: string;
  productName: string;
  productSku: string;
  productBarcode?: string;
  ordered: number;
  alreadyPicked: number;
  unitPrice: number;
  lotNumber?: string;
}

export interface PickableSO {
  orderNumber: string;
  lines: PickableLine[];
}

/** Server-side loader for the toplama page. */
export const getSalesOrderForPicking = withAuth<string, PickableSO | null>(
  async (ctx, orderId) => {
    const order = await ctx.prisma.salesOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId },
      select: {
        orderNumber: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            pickedQty: true,
            unitPrice: true,
            lotNumber: true,
            product: { select: { name: true, sku: true, barcode: true } },
          },
        },
      },
    });
    if (!order) return ok(null);

    return ok({
      orderNumber: order.orderNumber,
      lines: order.items.map((it) => ({
        itemId: it.id,
        productId: it.productId,
        productName: it.product?.name ?? "Bilinmeyen",
        productSku: it.product?.sku ?? "",
        productBarcode: it.product?.barcode ?? undefined,
        ordered: Number(it.quantity),
        alreadyPicked: Number(it.pickedQty ?? 0),
        unitPrice: Number(it.unitPrice),
        lotNumber: it.lotNumber ?? undefined,
      })),
    });
  }
);


const receiveSchema = z.object({
  orderId: z.string(),
  lines: z
    .array(
      z.object({
        itemId: z.string(),
        quantity: z.number().nonnegative(),
        lotNumber: z.string().optional(),
        expiryDate: z.string().optional(),
        rejected: z.number().nonnegative().optional(),
        rejectionReason: z.string().optional(),
      })
    )
    .min(1, "En az bir satır"),
});

export const receivePurchaseOrder = withAuth<
  z.input<typeof receiveSchema>,
  { movementsCreated: number; status: POStatus }
>(async (ctx, raw) => {
  const { orderId, lines } = parseInput(receiveSchema, raw);

  const order = await ctx.prisma.purchaseOrder.findFirst({
    where: { id: orderId, companyId: ctx.companyId },
    select: { id: true, warehouseId: true, companyId: true, status: true },
  });
  if (!order) throw ERR.notFound("Sipariş");
  if (order.status !== "approved" && order.status !== "partial") {
    return fail("invalid_state", "Sipariş onaylı veya kısmen alınmış olmalı");
  }

  // Do all writes inside a single transaction. If any line fails mid-flight,
  // the whole receive is rolled back (safer than the old "continue on error").
  const movementsCreated = await ctx.prisma.$transaction(async (tx) => {
    let created = 0;

    for (const line of lines) {
      if (line.quantity <= 0) continue;

      const item = await tx.purchaseOrderItem.findFirst({
        where: { id: line.itemId, order: { id: orderId } },
        select: {
          id: true,
          productId: true,
          quantity: true,
          receivedQuantity: true,
          unitPrice: true,
        },
      });
      if (!item) continue;

      await applyStockMovement(tx, {
        companyId: order.companyId,
        productId: item.productId,
        movementType: "in",
        quantity: line.quantity,
        toWarehouseId: order.warehouseId,
        lotNumber: line.lotNumber ?? null,
        expiryDate: line.expiryDate ?? null,
        unitCost: Number(item.unitPrice),
        reason: "purchase_order_receive",
        referenceType: "purchase_order",
        referenceNumber: orderId,
        userId: ctx.userId,
      });

      await tx.purchaseOrderItem.update({
        where: { id: line.itemId },
        data: {
          receivedQuantity:
            Number(item.receivedQuantity ?? 0) + line.quantity,
        },
      });

      created++;
    }

    return created;
  });

  // Decide new status: did all items reach their ordered quantity?
  const items = await ctx.prisma.purchaseOrderItem.findMany({
    where: { orderId },
    select: { quantity: true, receivedQuantity: true },
  });
  const allFull = items.every(
    (i) => Number(i.receivedQuantity) >= Number(i.quantity)
  );
  const nextStatus: POStatus = allFull ? "received" : "partial";

  await ctx.prisma.purchaseOrder.update({
    where: { id: orderId },
    data: {
      status: nextStatus,
      receivedDate: allFull ? new Date() : null,
    },
  });

  await logAudit(ctx, {
    action: "update",
    table: "purchase_orders",
    recordId: orderId,
    newData: { status: nextStatus, movements: movementsCreated },
  });

  return ok({ movementsCreated, status: nextStatus });
});

// ============================================
// 4.3 + 4.4 — PICK + SHIP (sales orders)
// ============================================

const pickSchema = z.object({
  orderId: z.string(),
  lines: z
    .array(
      z.object({
        itemId: z.string(),
        pickedQty: z.number().nonnegative(),
      })
    )
    .min(1),
});

export const recordPick = withAuth<z.input<typeof pickSchema>, void>(
  async (ctx, raw) => {
    const { orderId, lines } = parseInput(pickSchema, raw);

    // Verify the order belongs to this company.
    const order = await ctx.prisma.salesOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!order) throw ERR.notFound("Sipariş");

    // Don't allow picking more than was ordered.
    const orderItems = await ctx.prisma.salesOrderItem.findMany({
      where: { orderId },
      select: { id: true, quantity: true },
    });
    const orderedById = new Map(
      orderItems.map((i) => [i.id, Number(i.quantity)])
    );
    for (const ln of lines) {
      const ordered = orderedById.get(ln.itemId);
      if (ordered === undefined) {
        return fail("validation", "Sipariş kalemi bulunamadı");
      }
      if (ln.pickedQty > ordered) {
        return fail(
          "validation",
          `Toplanan miktar (${ln.pickedQty}) sipariş miktarını (${ordered}) aşamaz`
        );
      }
    }

    await ctx.prisma.$transaction(async (tx) => {
      for (const ln of lines) {
        await tx.salesOrderItem.updateMany({
          where: { id: ln.itemId, orderId },
          data: { pickedQty: ln.pickedQty },
        });
      }

      const items = await tx.salesOrderItem.findMany({
        where: { orderId },
        select: { quantity: true, pickedQty: true },
      });
      const allPicked = items.every(
        (i) => Number(i.pickedQty) >= Number(i.quantity)
      );

      if (allPicked) {
        await tx.salesOrder.update({
          where: { id: orderId },
          data: { pickedAt: new Date(), pickedById: ctx.userId },
        });
      }
    });

    await logAudit(ctx, {
      action: "update",
      table: "sales_orders",
      recordId: orderId,
      newData: { picked: true },
    });
    return ok();
  }
);

const shipSchema = z.object({
  orderId: z.string(),
  carrier: z.string().min(1, "Kargo firması zorunlu"),
  trackingNumber: z.string().optional(),
  shipDate: z.string().optional(),
  waybill: z.string().optional(),
  invoiceNo: z.string().optional(),
});

export const shipSalesOrder = withAuth<
  z.input<typeof shipSchema>,
  { movementsCreated: number }
>(async (ctx, raw) => {
  const data = parseInput(shipSchema, raw);

  const order = await ctx.prisma.salesOrder.findFirst({
    where: { id: data.orderId, companyId: ctx.companyId },
    select: {
      id: true,
      warehouseId: true,
      companyId: true,
      status: true,
      notes: true,
    },
  });
  if (!order) throw ERR.notFound("Sipariş");
  if (order.status !== "approved") {
    return fail(
      "invalid_state",
      "Sadece onaylı siparişler sevkedilebilir"
    );
  }

  const items = await ctx.prisma.salesOrderItem.findMany({
    where: { orderId: data.orderId },
    select: {
      id: true,
      productId: true,
      quantity: true,
      pickedQty: true,
      lotNumber: true,
      unitPrice: true,
    },
  });

  // FEFO consumption inside one transaction. If any line is short on stock the
  // engine throws InsufficientStockError and the whole shipment rolls back.
  const movementsCreated = await ctx.prisma.$transaction(async (tx) => {
    const allowNegative = await allowNegativeStock(tx, order.companyId);
    let count = 0;
    for (const item of items) {
      const qty = Number(item.pickedQty) || Number(item.quantity);
      if (qty <= 0) continue;
      // Release the stock this order reserved at approval time, then consume.
      // We release the full ordered quantity (any unshipped remainder is freed)
      // so reservations don't leak after the order is closed.
      await releaseReservation(tx, {
        companyId: order.companyId,
        productId: item.productId,
        warehouseId: order.warehouseId,
        quantity: Number(item.quantity),
      });
      await applyStockMovement(tx, {
        companyId: order.companyId,
        productId: item.productId,
        movementType: "out",
        quantity: qty,
        fromWarehouseId: order.warehouseId,
        lotNumber: item.lotNumber ?? null,
        reason: "sales_order_ship",
        referenceType: "sales_order",
        referenceNumber: data.orderId,
        userId: ctx.userId,
        allowNegative,
      });
      count++;
    }
    return count;
  });

  const noteLines = [
    `[SEVK ${new Date().toISOString().slice(0, 10)}] ${data.carrier}`,
    data.trackingNumber ? `Takip: ${data.trackingNumber}` : null,
    data.waybill ? `İrsaliye: ${data.waybill}` : null,
    data.invoiceNo ? `Fatura: ${data.invoiceNo}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  await ctx.prisma.salesOrder.update({
    where: { id: data.orderId },
    data: {
      status: "shipped",
      shipDate: data.shipDate
        ? new Date(data.shipDate)
        : new Date(),
      notes: (order.notes ?? "") + "\n" + noteLines,
    },
  });

  await logAudit(ctx, {
    action: "update",
    table: "sales_orders",
    recordId: data.orderId,
    newData: {
      status: "shipped",
      carrier: data.carrier,
      trackingNumber: data.trackingNumber,
    },
  });

  return ok({ movementsCreated });
});

// ============================================
// 4.5 — SALES ORDER: CREATE / LIST / APPROVE / CANCEL
// ============================================

export interface SalesOrderRow {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  warehouseId: string;
  status: SOStatus;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  pickedAt: string | null;
  notes: string | null;
}

export const getSalesOrders = withAuth<
  { status?: SOStatus; search?: string } | undefined,
  SalesOrderRow[]
>(async (ctx, filters) => {
  const rows = await ctx.prisma.salesOrder.findMany({
    where: {
      companyId: ctx.companyId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.search
        ? {
            OR: [
              { orderNumber: { contains: filters.search, mode: "insensitive" } },
              {
                customer: {
                  name: { contains: filters.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  return ok(
    rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerId: o.customerId,
      customerName: o.customer?.name ?? "—",
      warehouseId: o.warehouseId,
      status: o.status as SOStatus,
      totalAmount: Number(o.totalAmount),
      itemCount: o._count.items,
      createdAt: o.createdAt.toISOString(),
      pickedAt: o.pickedAt?.toISOString() ?? null,
      notes: o.notes ?? null,
    }))
  );
});

const createSOSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçin"),
  warehouseId: z.string().min(1, "Depo seçin"),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().positive("Miktar 0'dan büyük olmalı"),
        unitPrice: z.number().nonnegative().optional(),
        lotNumber: z.string().optional(),
      })
    )
    .min(1, "En az bir kalem ekleyin"),
});

export const createSalesOrder = withAuth<
  z.input<typeof createSOSchema>,
  { orderId: string }
>(async (ctx, raw) => {
  await assertModuleEnabled(ctx, "sales");
  const data = parseInput(createSOSchema, raw);

  const [customer, warehouse, products] = await Promise.all([
    ctx.prisma.customer.findFirst({
      where: { id: data.customerId, companyId: ctx.companyId },
      select: { id: true },
    }),
    ctx.prisma.warehouse.findFirst({
      where: { id: data.warehouseId, companyId: ctx.companyId },
      select: { id: true },
    }),
    ctx.prisma.product.findMany({
      where: {
        companyId: ctx.companyId,
        id: { in: data.items.map((i) => i.productId) },
      },
      select: { id: true, salePrice: true, taxRate: true },
    }),
  ]);
  if (!customer) throw ERR.notFound("Müşteri");
  if (!warehouse) throw ERR.notFound("Depo");

  const priceById = new Map(
    products.map((p) => [
      p.id,
      { sale: Number(p.salePrice), tax: Number(p.taxRate) },
    ])
  );

  let subtotal = 0;
  let taxAmount = 0;
  const itemData = data.items.map((it) => {
    const p = priceById.get(it.productId);
    if (!p) throw ERR.notFound("Ürün");
    const unitPrice = it.unitPrice ?? p.sale;
    const lineTotal = unitPrice * it.quantity;
    subtotal += lineTotal;
    taxAmount += lineTotal * (p.tax / 100);
    return {
      productId: it.productId,
      quantity: it.quantity,
      unitPrice,
      taxRate: p.tax,
      total: lineTotal,
      lotNumber: it.lotNumber ?? null,
    };
  });

  const orderNumber = `SO-${Date.now().toString().slice(-8)}`;

  const order = await ctx.prisma.salesOrder.create({
    data: {
      companyId: ctx.companyId,
      customerId: data.customerId,
      warehouseId: data.warehouseId,
      orderNumber,
      status: "pending",
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount,
      notes: data.notes ?? null,
      userId: ctx.userId,
      items: { create: itemData },
    },
    select: { id: true },
  });

  await logAudit(ctx, {
    action: "create",
    table: "sales_orders",
    recordId: order.id,
    newData: { orderNumber, status: "pending" },
  });

  return ok({ orderId: order.id });
});

/**
 * Approve a sales order: reserves stock for each line (FEFO) so it's held for
 * this customer, then moves the order to `approved`. Fails the whole approval if
 * any line is short on stock. Restricted to admin + manager.
 */
export const approveSalesOrder = withRole<z.input<typeof idSchema>, void>(
  ["admin", "manager"],
  async (ctx, raw) => {
    const { orderId } = parseInput(idSchema, raw);

    const order = await ctx.prisma.salesOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId },
      select: {
        id: true,
        status: true,
        warehouseId: true,
        companyId: true,
        items: { select: { productId: true, quantity: true } },
      },
    });
    if (!order) throw ERR.notFound("Sipariş");
    if (order.status !== "pending") {
      return fail(
        "invalid_state",
        "Sadece onay bekleyen siparişler onaylanabilir"
      );
    }

    await ctx.prisma.$transaction(async (tx) => {
      const allowNegative = await allowNegativeStock(tx, order.companyId);
      for (const it of order.items) {
        await reserveFEFO(tx, {
          companyId: order.companyId,
          productId: it.productId,
          warehouseId: order.warehouseId,
          quantity: Number(it.quantity),
          allowNegative,
        });
      }
      await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: "approved" },
      });
    });

    await logAudit(ctx, {
      action: "approve",
      table: "sales_orders",
      recordId: orderId,
      newData: { status: "approved" },
    });
    return ok();
  }
);

/** Cancel a sales order, releasing any stock it had reserved. */
export const cancelSalesOrder = withAuth<z.input<typeof idSchema>, void>(
  async (ctx, raw) => {
    const { orderId } = parseInput(idSchema, raw);

    const order = await ctx.prisma.salesOrder.findFirst({
      where: { id: orderId, companyId: ctx.companyId },
      select: {
        id: true,
        status: true,
        warehouseId: true,
        companyId: true,
        items: { select: { productId: true, quantity: true } },
      },
    });
    if (!order) throw ERR.notFound("Sipariş");
    if (
      order.status === "shipped" ||
      order.status === "delivered" ||
      order.status === "cancelled"
    ) {
      return fail("invalid_state", "Bu sipariş iptal edilemez");
    }

    await ctx.prisma.$transaction(async (tx) => {
      if (order.status === "approved") {
        for (const it of order.items) {
          await releaseReservation(tx, {
            companyId: order.companyId,
            productId: it.productId,
            warehouseId: order.warehouseId,
            quantity: Number(it.quantity),
          });
        }
      }
      await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: "cancelled" },
      });
    });

    await logAudit(ctx, {
      action: "update",
      table: "sales_orders",
      recordId: orderId,
      newData: { status: "cancelled" },
    });
    return ok();
  }
);

// ============================================
// 4.10 — OPERATIONS DASHBOARD (counts of open work)
// ============================================

export interface OperationsSummary {
  pendingPOs: number;
  approvedPOs: number;
  pickingSOs: number;
  shippingSOs: number;
  openCounts: number;
  pendingReturns: number;
}

export const getOperationsSummary = withAuth<void, OperationsSummary>(
  async (ctx) => {
    const [
      pendingPOs,
      approvedPOs,
      pickingSOs,
      shippingSOs,
      openCounts,
      pendingReturns,
    ] = await Promise.all([
      ctx.prisma.purchaseOrder.count({
        where: { companyId: ctx.companyId, status: "pending" },
      }),
      ctx.prisma.purchaseOrder.count({
        where: { companyId: ctx.companyId, status: "approved" },
      }),
      ctx.prisma.salesOrder.count({
        where: {
          companyId: ctx.companyId,
          status: { in: ["pending", "approved"] },
          pickedAt: null,
        },
      }),
      ctx.prisma.salesOrder.count({
        where: {
          companyId: ctx.companyId,
          status: "approved",
          pickedAt: { not: null },
        },
      }),
      ctx.prisma.stockCount.count({
        where: {
          companyId: ctx.companyId,
          status: { in: ["open", "in_progress", "review"] },
        },
      }),
      ctx.prisma.return.count({
        where: {
          companyId: ctx.companyId,
          status: { in: ["pending", "approved"] },
        },
      }),
    ]);

    return ok({
      pendingPOs,
      approvedPOs,
      pickingSOs,
      shippingSOs,
      openCounts,
      pendingReturns,
    });
  }
);
