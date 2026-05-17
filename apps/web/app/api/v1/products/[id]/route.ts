import { authenticateRequest, errorResponse, json, requireScope } from "@/lib/api/auth";
import { serviceClient } from "@/lib/supabase/service";
import { toProductWithStock } from "@/lib/mappers";

/** GET /api/v1/products/:id */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) return errorResponse(auth.status, auth.error);
  if (!requireScope(auth.ctx, "read")) return errorResponse(403, "forbidden");

  const { id } = await params;
  if (auth.ctx.companyId === "demo-company") return errorResponse(404, "not_found");

  const { data, error } = await serviceClient()
    .from("product_stock_summary")
    .select("*")
    .eq("company_id", auth.ctx.companyId)
    .eq("product_id", id)
    .maybeSingle();

  if (error) return errorResponse(500, "database_error", error.message);
  if (!data) return errorResponse(404, "not_found");

  return json({ data: toProductWithStock(data) });
}
