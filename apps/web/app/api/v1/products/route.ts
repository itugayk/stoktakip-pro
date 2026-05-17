import { authenticateRequest, errorResponse, json, requireScope } from "@/lib/api/auth";
import { serviceClient } from "@/lib/supabase/service";
import { toProductWithStock } from "@/lib/mappers";

/**
 * GET /api/v1/products
 *   ?q=…           text search (name/sku/barcode)
 *   ?limit=50      max 200
 *   ?offset=0      pagination cursor
 *
 * Authorization: Bearer sk_live_xxx (scope: read)
 */
export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return errorResponse(auth.status, auth.error);
  if (!requireScope(auth.ctx, "read")) return errorResponse(403, "forbidden");

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  if (auth.ctx.companyId === "demo-company") {
    return json({ data: [], total: 0, limit, offset });
  }

  let query = serviceClient()
    .from("product_stock_summary")
    .select("*", { count: "exact" })
    .eq("company_id", auth.ctx.companyId)
    .range(offset, offset + limit - 1);

  if (q) {
    const escaped = q.replace(/[%_]/g, "\\$&");
    query = query.or(`name.ilike.%${escaped}%,sku.ilike.%${escaped}%,barcode.ilike.%${escaped}%`);
  }

  const { data, count, error } = await query;
  if (error) return errorResponse(500, "database_error", error.message);

  return json({
    data: (data ?? []).map(toProductWithStock),
    total: count ?? 0,
    limit,
    offset,
  });
}
