"use server";

import { withAuth, ok, parseInput, z, ERR } from "@/lib/server";
import { bucketByWeek, forecastDemand, type ForecastPoint, type WeeklyDataPoint } from "@/lib/forecast/moving-average";

const forecastSchema = z.object({
  productId: z.string(),
  /** How many weeks ahead. Defaults to 4. */
  horizon: z.number().int().positive().max(26).optional(),
});

export interface ProductForecast {
  history: WeeklyDataPoint[];
  forecast: ForecastPoint[];
}

export const getProductForecast = withAuth<z.input<typeof forecastSchema>, ProductForecast>(
  async (ctx, raw) => {
    const { productId, horizon = 4 } = parseInput(forecastSchema, raw);

    if (ctx.demo) {
      // Fabricate a 12-week history for demo mode.
      const today = new Date();
      const history: WeeklyDataPoint[] = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - (11 - i) * 7);
        return {
          weekStart: d.toISOString().slice(0, 10),
          qty: Math.round(15 + Math.sin(i / 2) * 8 + Math.random() * 5),
        };
      });
      return ok({ history, forecast: forecastDemand(history, { horizon }) });
    }

    const oneYearAgo = new Date(Date.now() - 370 * 86400000).toISOString();
    const { data, error } = await ctx.supabase
      .from("stock_movements")
      .select("created_at, quantity")
      .eq("product_id", productId)
      .eq("movement_type", "out")
      .gte("created_at", oneYearAgo)
      .order("created_at");
    if (error) throw ERR.database(error.message);

    const today = new Date();
    const since = new Date(today);
    since.setUTCDate(since.getUTCDate() - 84); // 12 weeks of recent history
    const history = bucketByWeek(
      (data ?? []).map((m) => ({ createdAt: m.created_at, quantity: Number(m.quantity) })),
      since.toISOString().slice(0, 10),
      today.toISOString().slice(0, 10)
    );

    return ok({ history, forecast: forecastDemand(history, { horizon }) });
  }
);
