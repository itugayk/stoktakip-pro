"use server";

import { withAuth, withRole, ok, fail, parseInput, z, ERR, logAudit } from "@/lib/server";

export type POStatus = "draft" | "pending" | "approved" | "received" | "partial" | "cancelled";
export type SOStatus = "draft" | "pending" | "approved" | "shipped" | "delivered" | "cancelled";

// ============================================
// 4.1 — PURCHASE ORDER STATE MACHINE
// ============================================

const idSchema = z.object({ orderId: z.string() });
const rejectSchema = z.object({ orderId: z.string(), reason: z.string().min(1, "Red sebebi gerekli") });

export const submitForApproval = withAuth<z.input<typeof idSchema>, void>(async (ctx, raw) => {
  const { orderId } = parseInput(idSchema, raw);
  if (ctx.demo) return ok();

  const { data: before, error: readErr } = await ctx.supabase
    .from("purchase_orders")
    .select("status, total_amount")
    .eq("id", orderId)
    .single();
  if (readErr) throw ERR.database(readErr.message);
  if (before.status !== "draft") {
    return fail("invalid_state", "Sadece draft siparişler onaya gönderilebilir");
  }

  const { error } = await ctx.supabase
    .from("purchase_orders")
    .update({ status: "pending" })
    .eq("id", orderId);
  if (error) throw ERR.database(error.message);

  await logAudit(ctx, {
    action: "update",
    table: "purchase_orders",
    recordId: orderId,
    oldData: { status: "draft" },
    newData: { status: "pending" },
  });
  return ok();
});

/** Approve a PO. Restricted to admin + manager. */
export const approveOrder = withRole<z.input<typeof idSchema>, void>(
  ["admin", "manager"],
  async (ctx, raw) => {
    const { orderId } = parseInput(idSchema, raw);
    if (ctx.demo) return ok();

    const { data: before, error: readErr } = await ctx.supabase
      .from("purchase_orders")
      .select("status, total_amount, company_id")
      .eq("id", orderId)
      .single();
    if (readErr) throw ERR.database(readErr.message);
    if (before.status !== "pending") {
      return fail("invalid_state", "Sadece onay bekleyen siparişler onaylanabilir");
    }

    // Honor companies.settings.po_approval_threshold if set: amounts beyond
    // the threshold may require an admin (manager won't suffice). Manager who
    // is over-threshold is still allowed if they have admin role downstream.
    if (ctx.role === "manager") {
      const { data: company } = await ctx.supabase
        .from("companies")
        .select("settings")
        .eq("id", before.company_id)
        .single();
      const threshold = (company?.settings as { po_approval_threshold?: number } | null)
        ?.po_approval_threshold;
      if (typeof threshold === "number" && Number(before.total_amount) > threshold) {
        return fail(
          "threshold_exceeded",
          `Bu tutar (${before.total_amount}₺) manager onay limitini (${threshold}₺) aşıyor`
        );
      }
    }

    const { error } = await ctx.supabase
      .from("purchase_orders")
      .update({ status: "approved" })
      .eq("id", orderId);
    if (error) throw ERR.database(error.message);

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
    if (ctx.demo) return ok();

    const { data: before } = await ctx.supabase
      .from("purchase_orders")
      .select("status, notes")
      .eq("id", orderId)
      .single();
    if (!before) throw ERR.notFound("Sipariş");
    if (before.status !== "pending") {
      return fail("invalid_state", "Sadece onay bekleyen siparişler reddedilebilir");
    }

    const notesAppendix = `\n[RED ${new Date().toISOString().slice(0, 10)}] ${reason}`;
    const { error } = await ctx.supabase
      .from("purchase_orders")
      .update({
        status: "cancelled",
        notes: (before.notes ?? "") + notesAppendix,
      })
      .eq("id", orderId);
    if (error) throw ERR.database(error.message);

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

export const cancelOrder = withAuth<z.input<typeof idSchema>, void>(async (ctx, raw) => {
  const { orderId } = parseInput(idSchema, raw);
  if (ctx.demo) return ok();

  const { error } = await ctx.supabase
    .from("purchase_orders")
    .update({ status: "cancelled" })
    .eq("id", orderId)
    .in("status", ["draft", "pending"]);
  if (error) throw ERR.database(error.message);

  await logAudit(ctx, {
    action: "update",
    table: "purchase_orders",
    recordId: orderId,
    newData: { status: "cancelled" },
  });
  return ok();
});

// ============================================
// 4.2 — PURCHASE ORDER RECEIVING
// ============================================

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
  if (ctx.demo) return ok({ movementsCreated: lines.length, status: "received" });

  const { data: order } = await ctx.supabase
    .from("purchase_orders")
    .select("id, warehouse_id, company_id, status")
    .eq("id", orderId)
    .single();
  if (!order) throw ERR.notFound("Sipariş");
  if (order.status !== "approved" && order.status !== "partial") {
    return fail("invalid_state", "Sipariş onaylı veya kısmen alınmış olmalı");
  }

  let movementsCreated = 0;
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    // Read the matching order item to learn product_id.
    const { data: item } = await ctx.supabase
      .from("purchase_order_items")
      .select("id, product_id, quantity, received_quantity, unit_price")
      .eq("id", line.itemId)
      .single();
    if (!item) continue;

    const { error: moveErr } = await ctx.supabase.from("stock_movements").insert({
      company_id: order.company_id,
      product_id: item.product_id,
      movement_type: "in",
      quantity: line.quantity,
      to_warehouse_id: order.warehouse_id,
      lot_number: line.lotNumber ?? null,
      expiry_date: line.expiryDate ?? null,
      unit_cost: item.unit_price,
      reason: "purchase_order_receive",
      reference_type: "purchase_order",
      reference_number: orderId,
      user_id: ctx.userId,
    } as never);
    if (moveErr) continue;

    // Bump inventory.
    await ctx.supabase.from("inventory").insert({
      company_id: order.company_id,
      product_id: item.product_id,
      warehouse_id: order.warehouse_id,
      lot_number: line.lotNumber ?? null,
      expiry_date: line.expiryDate ?? null,
      quantity: line.quantity,
      unit_cost: item.unit_price,
    } as never);

    // Update received_quantity on the item.
    await ctx.supabase
      .from("purchase_order_items")
      .update({ received_quantity: Number(item.received_quantity ?? 0) + line.quantity })
      .eq("id", line.itemId);

    movementsCreated++;
  }

  // Decide new status: did all items reach their ordered quantity?
  const { data: items } = await ctx.supabase
    .from("purchase_order_items")
    .select("quantity, received_quantity")
    .eq("order_id", orderId);

  const allFull = (items ?? []).every(
    (i) => Number(i.received_quantity ?? 0) >= Number(i.quantity)
  );
  const nextStatus: POStatus = allFull ? "received" : "partial";

  await ctx.supabase
    .from("purchase_orders")
    .update({
      status: nextStatus,
      received_date: allFull ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", orderId);

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

export const recordPick = withAuth<z.input<typeof pickSchema>, void>(async (ctx, raw) => {
  const { orderId, lines } = parseInput(pickSchema, raw);
  if (ctx.demo) return ok();

  for (const ln of lines) {
    await ctx.supabase
      .from("sales_order_items")
      .update({ picked_qty: ln.pickedQty })
      .eq("id", ln.itemId);
  }

  // Mark when all items have picked_qty >= quantity.
  const { data: items } = await ctx.supabase
    .from("sales_order_items")
    .select("quantity, picked_qty")
    .eq("order_id", orderId);
  const allPicked = (items ?? []).every(
    (i) => Number((i as { picked_qty?: number }).picked_qty ?? 0) >= Number(i.quantity)
  );

  if (allPicked) {
    await ctx.supabase
      .from("sales_orders")
      .update({
        picked_at: new Date().toISOString(),
        picked_by: ctx.userId,
      } as never)
      .eq("id", orderId);
  }

  await logAudit(ctx, {
    action: "update",
    table: "sales_orders",
    recordId: orderId,
    newData: { picked: allPicked },
  });
  return ok();
});

const shipSchema = z.object({
  orderId: z.string(),
  carrier: z.string().min(1, "Kargo firması zorunlu"),
  trackingNumber: z.string().optional(),
  shipDate: z.string().optional(),
  waybill: z.string().optional(),
  invoiceNo: z.string().optional(),
});

export const shipSalesOrder = withAuth<z.input<typeof shipSchema>, { movementsCreated: number }>(
  async (ctx, raw) => {
    const data = parseInput(shipSchema, raw);
    if (ctx.demo) return ok({ movementsCreated: 0 });

    const { data: order } = await ctx.supabase
      .from("sales_orders")
      .select("id, warehouse_id, company_id, status, notes")
      .eq("id", data.orderId)
      .single();
    if (!order) throw ERR.notFound("Sipariş");
    if (order.status !== "approved" && order.status !== "pending") {
      return fail("invalid_state", "Sadece onaylı veya hazır siparişler sevkedilebilir");
    }

    const { data: items } = await ctx.supabase
      .from("sales_order_items")
      .select("id, product_id, quantity, picked_qty, lot_number, unit_price")
      .eq("order_id", data.orderId);

    let movementsCreated = 0;
    for (const it of items ?? []) {
      const item = it as unknown as {
        product_id: string;
        quantity: number;
        picked_qty?: number;
        lot_number?: string | null;
        unit_price?: number;
      };
      const qty = Number(item.picked_qty ?? item.quantity);
      const { error } = await ctx.supabase.from("stock_movements").insert({
        company_id: order.company_id,
        product_id: item.product_id,
        movement_type: "out",
        quantity: qty,
        from_warehouse_id: order.warehouse_id,
        lot_number: item.lot_number ?? null,
        unit_cost: item.unit_price ?? null,
        reason: "sales_order_ship",
        reference_type: "sales_order",
        reference_number: data.orderId,
        user_id: ctx.userId,
      } as never);
      if (!error) movementsCreated++;
    }

    const noteLines = [
      `[SEVK ${new Date().toISOString().slice(0, 10)}] ${data.carrier}`,
      data.trackingNumber ? `Takip: ${data.trackingNumber}` : null,
      data.waybill ? `İrsaliye: ${data.waybill}` : null,
      data.invoiceNo ? `Fatura: ${data.invoiceNo}` : null,
    ]
      .filter(Boolean)
      .join(" • ");

    await ctx.supabase
      .from("sales_orders")
      .update({
        status: "shipped",
        ship_date: data.shipDate ?? new Date().toISOString().slice(0, 10),
        notes: (order.notes ?? "") + "\n" + noteLines,
      })
      .eq("id", data.orderId);

    await logAudit(ctx, {
      action: "update",
      table: "sales_orders",
      recordId: data.orderId,
      newData: { status: "shipped", carrier: data.carrier, trackingNumber: data.trackingNumber },
    });

    return ok({ movementsCreated });
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

export const getOperationsSummary = withAuth<void, OperationsSummary>(async (ctx) => {
  if (ctx.demo) {
    return ok({
      pendingPOs: 2,
      approvedPOs: 1,
      pickingSOs: 3,
      shippingSOs: 1,
      openCounts: 1,
      pendingReturns: 0,
    });
  }

  const [pendingPOs, approvedPOs, pickingSOs, shippingSOs, openCounts, pendingReturns] =
    await Promise.all([
      ctx.supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ctx.supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("status", "approved"),
      ctx.supabase.from("sales_orders").select("id", { count: "exact", head: true }).in("status", ["pending", "approved"]).is("picked_at", null),
      ctx.supabase.from("sales_orders").select("id", { count: "exact", head: true }).eq("status", "approved").not("picked_at", "is", null),
      ctx.supabase.from("stock_counts").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress", "review"]),
      ctx.supabase.from("returns").select("id", { count: "exact", head: true }).in("status", ["pending", "approved"]),
    ]);

  return ok({
    pendingPOs: pendingPOs.count ?? 0,
    approvedPOs: approvedPOs.count ?? 0,
    pickingSOs: pickingSOs.count ?? 0,
    shippingSOs: shippingSOs.count ?? 0,
    openCounts: openCounts.count ?? 0,
    pendingReturns: pendingReturns.count ?? 0,
  });
});
