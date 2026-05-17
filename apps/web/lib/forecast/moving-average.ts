/**
 * Simple demand forecast: weighted moving average over the last N weeks +
 * an optional seasonal adjustment using the same week from last year.
 *
 * Pure TS — no IO; safe to unit-test.
 *
 * Input: weekly time series indexed by ISO-week start (Monday) date string.
 * Output: forecast for the next `horizon` weeks plus a confidence band.
 */

export interface WeeklyDataPoint {
  /** ISO date (YYYY-MM-DD) of the Monday of the week. */
  weekStart: string;
  qty: number;
}

export interface ForecastPoint {
  weekStart: string;
  forecast: number;
  lower: number;
  upper: number;
}

export interface ForecastOptions {
  /** How many weeks ahead to forecast. */
  horizon?: number;
  /** Window size for the moving average. */
  window?: number;
  /** Whether to apply a year-over-year seasonal multiplier. */
  seasonal?: boolean;
  /** Stddev multiplier for the confidence band. ~1 = 68%, 1.96 = 95%. */
  bandStddev?: number;
}

/**
 * Build a 1-year+ history (or as far back as we have data) into a series of
 * weekly buckets, with zero-fill for empty weeks.
 */
export function bucketByWeek(
  events: { createdAt: string; quantity: number }[],
  fromIso: string,
  toIso: string
): WeeklyDataPoint[] {
  const from = new Date(fromIso);
  const to = new Date(toIso);

  // Snap to Monday.
  const start = new Date(from);
  const dow = (start.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  start.setUTCDate(start.getUTCDate() - dow);

  const weeks = new Map<string, number>();
  for (let d = new Date(start); d <= to; d.setUTCDate(d.getUTCDate() + 7)) {
    weeks.set(d.toISOString().slice(0, 10), 0);
  }

  for (const e of events) {
    const dt = new Date(e.createdAt);
    const dowE = (dt.getUTCDay() + 6) % 7;
    dt.setUTCDate(dt.getUTCDate() - dowE);
    const key = dt.toISOString().slice(0, 10);
    weeks.set(key, (weeks.get(key) ?? 0) + e.quantity);
  }

  return Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, qty]) => ({ weekStart, qty }));
}

function weightedMovingAverage(series: WeeklyDataPoint[], window: number): number {
  const slice = series.slice(-window);
  if (slice.length === 0) return 0;
  // Linear weights — most recent weighted highest.
  let weightSum = 0;
  let valSum = 0;
  slice.forEach((pt, i) => {
    const w = i + 1;
    weightSum += w;
    valSum += w * pt.qty;
  });
  return valSum / weightSum;
}

function stddev(series: WeeklyDataPoint[]): number {
  if (series.length < 2) return 0;
  const mean = series.reduce((s, p) => s + p.qty, 0) / series.length;
  const variance =
    series.reduce((s, p) => s + (p.qty - mean) ** 2, 0) / (series.length - 1);
  return Math.sqrt(variance);
}

/** Seasonal multiplier from same week last year. Defaults to 1 when unavailable. */
function seasonalFactor(series: WeeklyDataPoint[], targetWeek: string): number {
  const target = new Date(targetWeek);
  const lastYear = new Date(target);
  lastYear.setUTCFullYear(target.getUTCFullYear() - 1);
  const key = lastYear.toISOString().slice(0, 10);
  const baseline = series.find((p) => p.weekStart === key);
  if (!baseline || baseline.qty <= 0) return 1;
  const recent4 = series.slice(-4);
  const recentAvg = recent4.length === 0 ? 0 : recent4.reduce((s, p) => s + p.qty, 0) / recent4.length;
  if (recentAvg <= 0) return 1;
  // Clip to a reasonable range so a noisy yearly spike doesn't blow up.
  return Math.min(2, Math.max(0.3, baseline.qty / recentAvg));
}

export function forecastDemand(
  series: WeeklyDataPoint[],
  {
    horizon = 4,
    window = 12,
    seasonal = true,
    bandStddev = 1,
  }: ForecastOptions = {}
): ForecastPoint[] {
  if (series.length === 0) return [];

  const base = weightedMovingAverage(series, window);
  const sd = stddev(series.slice(-window));

  // Last week start in the series.
  const last = new Date(series[series.length - 1].weekStart);
  const points: ForecastPoint[] = [];

  for (let i = 1; i <= horizon; i++) {
    const next = new Date(last);
    next.setUTCDate(next.getUTCDate() + 7 * i);
    const key = next.toISOString().slice(0, 10);
    const factor = seasonal ? seasonalFactor(series, key) : 1;
    const forecast = Math.max(0, base * factor);
    const margin = sd * bandStddev;
    points.push({
      weekStart: key,
      forecast: Math.round(forecast * 100) / 100,
      lower: Math.max(0, Math.round((forecast - margin) * 100) / 100),
      upper: Math.round((forecast + margin) * 100) / 100,
    });
  }

  return points;
}
