"use server";

import type { Prisma } from "@prisma/client";
import { withAuth, ok, fail, parseInput, z, ERR, logAudit } from "@/lib/server";
import { assertModuleEnabled } from "@/lib/modules/guard";

type Tx = Prisma.TransactionClient;

// İrsaliye numbering: IRS-{year}-{seq}. Sequential per company.
async function nextNoteNumber(tx: Tx, companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.deliveryNote.count({
    where: { companyId, noteNumber: { startsWith: `IRS-${year}-` } },
  });
  return `IRS-${year}-${String(count + 1).padStart(5, "0")}`;
}

interface DerivedSource {
  customerId: string | null;
  supplierId: string | null;
  warehouseId: string | null;
  salesOrderId: string | null;
  purchaseOrderId: string | null;
  saleId: string | null;
  items: {
    productId: string;
    quantity: number;
    unit: string;
    unitPrice: number | null;
    lotNumber: string | null;
    description: string | null;
  }[];
}

// ============================================
// CREATE / LIST / DETAIL / STATUS / DELETE — İRSALİYE
// ============================================

const createDNSchema = z.object({
  type: z.enum(["outbound", "inbound"]),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  warehouseId: z.string().optional(),
  fromSaleId: z.string().optional(),
  fromSalesOrderId: z.string().optional(),
  fromPurchaseOrderId: z.string().optional(),
  issueDate: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().positive(),
        unit: z.string().optional(),
        unitPrice: z.number().nonnegative().optional(),
        lotNumber: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
});

export const createDeliveryNote = withAuth<
  z.input<typeof createDNSchema>,
  { id: string; noteNumber: string }
>(async (ctx, raw) => {
  await assertModuleEnabled(ctx, "delivery");
  const data = parseInput(createDNSchema, raw);

  let derived: DerivedSource = {
    customerId: data.customerId ?? null,
    supplierId: data.supplierId ?? null,
    warehouseId: data.warehouseId ?? null,
    salesOrderId: null,
    purchaseOrderId: null,
    saleId: null,
    items: (data.items ?? []).map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      unit: it.unit ?? "adet",
      unitPrice: it.unitPrice ?? null,
      lotNumber: it.lotNumber ?? null,
      description: it.description ?? null,
    })),
  };

  // Derive party + items from a source document when one is given.
  if (data.fromSaleId) {
    const sale = await ctx.prisma.sale.findFirst({
      where: { id: data.fromSaleId, companyId: ctx.companyId },
      include: { items: { include: { product: { select: { unit: true } } } } },
    });
    if (!sale) throw ERR.notFound("Satış");
    derived = {
      customerId: sale.customerId,
      supplierId: null,
      warehouseId: sale.warehouseId,
      salesOrderId: null,
      purchaseOrderId: null,
      saleId: sale.id,
      items: sale.items.map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        unit: it.product?.unit ?? "adet",
        unitPrice: Number(it.unitPrice),
        lotNumber: it.lotNumber,
        description: null,
      })),
    };
  } else if (data.fromSalesOrderId) {
    const so = await ctx.prisma.salesOrder.findFirst({
      where: { id: data.fromSalesOrderId, companyId: ctx.companyId },
      include: { items: { include: { product: { select: { unit: true } } } } },
    });
    if (!so) throw ERR.notFound("Satış siparişi");
    derived = {
      customerId: so.customerId,
      supplierId: null,
      warehouseId: so.warehouseId,
      salesOrderId: so.id,
      purchaseOrderId: null,
      saleId: null,
      items: so.items.map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        unit: it.product?.unit ?? "adet",
        unitPrice: Number(it.unitPrice),
        lotNumber: it.lotNumber,
        description: null,
      })),
    };
  } else if (data.fromPurchaseOrderId) {
    const po = await ctx.prisma.purchaseOrder.findFirst({
      where: { id: data.fromPurchaseOrderId, companyId: ctx.companyId },
      include: { items: { include: { product: { select: { unit: true } } } } },
    });
    if (!po) throw ERR.notFound("Satın alma siparişi");
    derived = {
      customerId: null,
      supplierId: po.supplierId,
      warehouseId: po.warehouseId,
      salesOrderId: null,
      purchaseOrderId: po.id,
      saleId: null,
      items: po.items.map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        unit: it.product?.unit ?? "adet",
        unitPrice: Number(it.unitPrice),
        lotNumber: it.lotNumber,
        description: null,
      })),
    };
  }

  if (derived.items.length === 0) {
    return fail("validation", "İrsaliyede en az bir kalem olmalı");
  }
  if (data.type === "outbound" && !derived.customerId) {
    return fail("validation", "Çıkış irsaliyesi için müşteri gerekli");
  }
  if (data.type === "inbound" && !derived.supplierId) {
    return fail("validation", "Giriş irsaliyesi için tedarikçi gerekli");
  }

  const created = await ctx.prisma.$transaction(async (tx) => {
    const noteNumber = await nextNoteNumber(tx, ctx.companyId);
    return tx.deliveryNote.create({
      data: {
        companyId: ctx.companyId,
        type: data.type,
        noteNumber,
        customerId: derived.customerId,
        supplierId: derived.supplierId,
        warehouseId: derived.warehouseId,
        salesOrderId: derived.salesOrderId,
        purchaseOrderId: derived.purchaseOrderId,
        saleId: derived.saleId,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        notes: data.notes ?? null,
        createdById: ctx.userId,
        items: {
          create: derived.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unitPrice,
            lotNumber: it.lotNumber,
            description: it.description,
          })),
        },
      },
      select: { id: true, noteNumber: true },
    });
  });

  await logAudit(ctx, {
    action: "create",
    table: "delivery_notes",
    recordId: created.id,
    newData: { noteNumber: created.noteNumber, type: data.type },
  });

  return ok(created);
});

export interface DeliveryNoteRow {
  id: string;
  noteNumber: string;
  type: "outbound" | "inbound";
  partyName: string;
  status: string;
  issueDate: string;
  itemCount: number;
}

export const listDeliveryNotes = withAuth<
  { type?: "outbound" | "inbound"; search?: string } | undefined,
  DeliveryNoteRow[]
>(async (ctx, filters) => {
  const rows = await ctx.prisma.deliveryNote.findMany({
    where: {
      companyId: ctx.companyId,
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.search
        ? { noteNumber: { contains: filters.search, mode: "insensitive" } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      customer: { select: { name: true } },
      supplier: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  return ok(
    rows.map((d) => ({
      id: d.id,
      noteNumber: d.noteNumber,
      type: d.type,
      partyName: d.customer?.name ?? d.supplier?.name ?? "—",
      status: d.status,
      issueDate: d.issueDate.toISOString().slice(0, 10),
      itemCount: d._count.items,
    }))
  );
});

export interface DeliveryNoteDetail {
  id: string;
  noteNumber: string;
  type: "outbound" | "inbound";
  status: string;
  issueDate: string;
  notes: string | null;
  party: { name: string; taxId?: string; address?: string; phone?: string } | null;
  company: { name: string; taxId?: string; address?: string; phone?: string };
  items: {
    name: string;
    sku: string;
    quantity: number;
    unit: string;
    unitPrice: number | null;
    lotNumber: string | null;
    description: string | null;
  }[];
}

export const getDeliveryNote = withAuth<string, DeliveryNoteDetail | null>(
  async (ctx, id) => {
    const [d, company] = await Promise.all([
      ctx.prisma.deliveryNote.findFirst({
        where: { id, companyId: ctx.companyId },
        include: {
          customer: true,
          supplier: true,
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
      }),
      ctx.prisma.company.findUnique({
        where: { id: ctx.companyId },
        select: { name: true, taxId: true, address: true, phone: true },
      }),
    ]);
    if (!d) return ok(null);

    const party = d.customer ?? d.supplier;
    return ok({
      id: d.id,
      noteNumber: d.noteNumber,
      type: d.type,
      status: d.status,
      issueDate: d.issueDate.toISOString().slice(0, 10),
      notes: d.notes,
      party: party
        ? {
            name: party.name,
            taxId: party.taxId ?? undefined,
            address: party.address ?? undefined,
            phone: party.phone ?? undefined,
          }
        : null,
      company: {
        name: company?.name ?? "",
        taxId: company?.taxId ?? undefined,
        address: company?.address ?? undefined,
        phone: company?.phone ?? undefined,
      },
      items: d.items.map((it) => ({
        name: it.product?.name ?? "—",
        sku: it.product?.sku ?? "",
        quantity: Number(it.quantity),
        unit: it.unit,
        unitPrice: it.unitPrice != null ? Number(it.unitPrice) : null,
        lotNumber: it.lotNumber,
        description: it.description,
      })),
    });
  }
);

const updateStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["draft", "issued", "delivered", "cancelled"]),
});

export const updateDeliveryNoteStatus = withAuth<
  z.input<typeof updateStatusSchema>,
  void
>(async (ctx, raw) => {
  const { id, status } = parseInput(updateStatusSchema, raw);
  const res = await ctx.prisma.deliveryNote.updateMany({
    where: { id, companyId: ctx.companyId },
    data: { status },
  });
  if (res.count === 0) throw ERR.notFound("İrsaliye");
  return ok();
});

export const deleteDeliveryNote = withAuth<string, void>(async (ctx, id) => {
  const res = await ctx.prisma.deliveryNote.deleteMany({
    where: { id, companyId: ctx.companyId },
  });
  if (res.count === 0) throw ERR.notFound("İrsaliye");
  return ok();
});
