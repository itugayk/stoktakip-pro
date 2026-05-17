"use server";

import { withAuth, withRole, ok, fail, parseInput, z, ERR, logAudit } from "@/lib/server";

export type ReturnType = "customer" | "supplier";
export type ReturnStatus = "pending" | "approved" | "received" | "rejected" | "cancelled";
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

export const createReturn = withAuth<z.input<typeof createSchema>, { returnId: string }>(
  async (ctx, raw) => {
    const data = parseInput(createSchema, raw);
    if (ctx.demo) return ok({ returnId: `ret-${Date.now()}` });

    if (data.type === "customer" && !data.customerId) {
      return fail("validation", "Müşteri iadesi için müşteri seçin", "customerId");
    }
    if (data.type === "supplier" && !data.supplierId) {
      return fail("validation", "Tedarikçi iadesi için tedarikçi seçin", "supplierId");
    }

    const { data: ret, error } = await ctx.supabase
      .from("returns")
      .insert({
        company_id: ctx.companyId,
        type: data.type,
        warehouse_id: data.warehouseId,
        customer_id: data.customerId ?? null,
        supplier_id: data.supplierId ?? null,
        related_order_id: data.relatedOrderId ?? null,
        reason: data.reason ?? null,
        notes: data.notes ?? null,
        created_by: ctx.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw ERR.database(error.message);

    const itemRows = data.items.map((it) => ({
      return_id: ret.id,
      product_id: it.productId,
      quantity: it.quantity,
      condition: it.condition,
      lot_number: it.lotNumber ?? null,
      unit_value: it.unitValue ?? null,
    }));
    const { error: itemErr } = await ctx.supabase
      .from("return_items")
      .insert(itemRows as never);
    if (itemErr) throw ERR.database(itemErr.message);

    await logAudit(ctx, {
      action: "create",
      table: "returns",
      recordId: ret.id,
      newData: data as unknown as Record<string, unknown>,
    });
    return ok({ returnId: ret.id });
  }
);

export const listReturns = withAuth<{ status?: ReturnStatus } | undefined, Return[]>(
  async (ctx, filter) => {
    if (ctx.demo) return ok([]);

    let q = ctx.supabase
      .from("returns")
      .select(`
        id, type, status, warehouse_id, customer_id, supplier_id,
        related_order_id, reason, notes, created_at,
        items:return_items(id, product_id, quantity, condition, lot_number, unit_value, product:products(name))
      `)
      .order("created_at", { ascending: false });
    if (filter?.status) q = q.eq("status", filter.status);

    const { data, error } = await q;
    if (error) throw ERR.database(error.message);

    return ok(
      (data ?? []).map((r) => ({
        id: r.id,
        type: r.type as ReturnType,
        status: r.status as ReturnStatus,
        warehouseId: r.warehouse_id,
        customerId: r.customer_id ?? undefined,
        supplierId: r.supplier_id ?? undefined,
        relatedOrderId: r.related_order_id ?? undefined,
        reason: r.reason ?? undefined,
        notes: r.notes ?? undefined,
        createdAt: r.created_at,
        items: ((r.items as unknown as {
          id: string;
          product_id: string;
          quantity: number;
          condition: ReturnItemCondition;
          lot_number?: string | null;
          unit_value?: number | null;
          product?: { name: string } | { name: string }[] | null;
        }[]) ?? []).map((it) => {
          const productRaw = it.product;
          const product = Array.isArray(productRaw) ? productRaw[0] : productRaw;
          return {
            id: it.id,
            productId: it.product_id,
            productName: product?.name,
            quantity: Number(it.quantity),
            condition: it.condition,
            lotNumber: it.lot_number ?? undefined,
            unitValue: it.unit_value != null ? Number(it.unit_value) : undefined,
          };
        }),
      }))
    );
  }
);

const idSchema = z.object({ returnId: z.string() });

export const approveReturn = withRole<z.input<typeof idSchema>, void>(
  ["admin", "manager"],
  async (ctx, raw) => {
    const { returnId } = parseInput(idSchema, raw);
    if (ctx.demo) return ok();
    const { error } = await ctx.supabase
      .from("returns")
      .update({
        status: "approved",
        approved_by: ctx.userId,
        approved_at: new Date().toISOString(),
      } as never)
      .eq("id", returnId)
      .eq("status", "pending");
    if (error) throw ERR.database(error.message);
    await logAudit(ctx, { action: "approve", table: "returns", recordId: returnId });
    return ok();
  }
);

export const receiveReturn = withAuth<z.input<typeof idSchema>, { movementsCreated: number }>(
  async (ctx, raw) => {
    const { returnId } = parseInput(idSchema, raw);
    if (ctx.demo) return ok({ movementsCreated: 0 });

    const { data: ret, error: readErr } = await ctx.supabase
      .from("returns")
      .select(`
        id, type, warehouse_id, company_id, status,
        items:return_items(product_id, quantity, condition, lot_number, unit_value)
      `)
      .eq("id", returnId)
      .single();
    if (readErr) throw ERR.database(readErr.message);
    if (ret.status !== "approved") {
      return fail("invalid_state", "Önce onaylayın");
    }

    const items = (ret.items as unknown as {
      product_id: string;
      quantity: number;
      condition: ReturnItemCondition;
      lot_number?: string | null;
      unit_value?: number | null;
    }[]) ?? [];

    let movementsCreated = 0;
    for (const it of items) {
      // Customer returns add stock back; supplier returns remove it.
      const isCustomer = ret.type === "customer";
      const { error } = await ctx.supabase.from("stock_movements").insert({
        company_id: ret.company_id,
        product_id: it.product_id,
        movement_type: isCustomer ? "in" : "out",
        quantity: it.quantity,
        from_warehouse_id: isCustomer ? null : ret.warehouse_id,
        to_warehouse_id: isCustomer ? ret.warehouse_id : null,
        lot_number: it.lot_number ?? null,
        unit_cost: it.unit_value ?? null,
        reason: `return_${ret.type}_${it.condition}`,
        reference_type: "return",
        reference_number: returnId,
        user_id: ctx.userId,
      } as never);
      if (!error) movementsCreated++;

      // For customer returns, resellable / damaged also adds to inventory.
      // scrap stays out of inventory.
      if (isCustomer && it.condition !== "scrap") {
        await ctx.supabase.from("inventory").insert({
          company_id: ret.company_id,
          product_id: it.product_id,
          warehouse_id: ret.warehouse_id,
          lot_number: it.lot_number ?? null,
          quantity: it.quantity,
          unit_cost: it.unit_value ?? 0,
        } as never);
      }
    }

    await ctx.supabase
      .from("returns")
      .update({ status: "received" })
      .eq("id", returnId);

    await logAudit(ctx, {
      action: "update",
      table: "returns",
      recordId: returnId,
      newData: { status: "received", movements: movementsCreated },
    });

    return ok({ movementsCreated });
  }
);
