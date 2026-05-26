"use server";

import { withAuth, ok, parseInput, z } from "@/lib/server";
import {
  bucketByWeek,
  forecastDemand,
  type ForecastPoint,
  type WeeklyDataPoint,
} from "@/lib/forecast/moving-average";

const forecastSchema = z.object({
  productId: z.string(),
  /** How many weeks ahead. Defaults to 4. */
  horizon: z.number().int().positive().max(26).optional(),
});

export interface ProductForecast {
  history: WeeklyDataPoint[];
  forecast: ForecastPoint[];
}

export const getProductForecast = withAuth<
  z.input<typeof forecastSchema>,
  ProductForecast
>(async (ctx, raw) => {
  const { productId, horizon = 4 } = parseInput(forecastSchema, raw);

  const oneYearAgo = new Date(Date.now() - 370 * 86400000);

  const movements = await ctx.prisma.stockMovement.findMany({
    where: {
      companyId: ctx.companyId,
      productId,
      movementType: "out",
      createdAt: { gte: oneYearAgo },
    },
    select: { createdAt: true, quantity: true },
    orderBy: { createdAt: "asc" },
  });

  const today = new Date();
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - 84); // 12 weeks of recent history

  const history = bucketByWeek(
    movements.map((m) => ({
      createdAt: m.createdAt.toISOString(),
      quantity: Number(m.quantity),
    })),
    since.toISOString().slice(0, 10),
    today.toISOString().slice(0, 10)
  );

  return ok({ history, forecast: forecastDemand(history, { horizon }) });
});
