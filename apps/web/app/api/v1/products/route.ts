import {
  authenticateRequest,
  errorResponse,
  json,
  requireScope,
} from "@/lib/api/auth";
import { prisma } from "@/lib/prisma";
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
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit")) || 50)
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const where = {
    companyId: auth.ctx.companyId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { sku: { contains: q, mode: "insensitive" as const } },
            { barcode: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.productStockSummary.findMany({
      where,
      skip: offset,
      take: limit,
    }),
    prisma.productStockSummary.count({ where }),
  ]);

  return json({
    data: rows.map(toProductWithStock),
    total,
    limit,
    offset,
  });
}
