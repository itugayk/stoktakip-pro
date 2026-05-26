import {
  authenticateRequest,
  errorResponse,
  json,
  requireScope,
} from "@/lib/api/auth";
import { prisma } from "@/lib/prisma";
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

  const row = await prisma.productStockSummary.findFirst({
    where: { productId: id, companyId: auth.ctx.companyId },
  });

  if (!row) return errorResponse(404, "not_found");
  return json({ data: toProductWithStock(row) });
}
