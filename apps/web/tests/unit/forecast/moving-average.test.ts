import { describe, it, expect } from "vitest";
import {
  bucketByWeek,
  forecastDemand,
  type WeeklyDataPoint,
} from "@/lib/forecast/moving-average";

describe("bucketByWeek", () => {
  it("zero-fills empty weeks in range", () => {
    const out = bucketByWeek([], "2026-01-05", "2026-01-26");
    expect(out.length).toBeGreaterThanOrEqual(3);
    out.forEach((p) => expect(p.qty).toBe(0));
  });

  it("snaps events to the Monday of their week", () => {
    // 2026-01-07 is a Wednesday; the Monday is 2026-01-05.
    const out = bucketByWeek(
      [{ createdAt: "2026-01-07", quantity: 5 }],
      "2026-01-05",
      "2026-01-12"
    );
    const mon = out.find((p) => p.weekStart === "2026-01-05");
    expect(mon?.qty).toBe(5);
  });

  it("sums multiple events in the same week", () => {
    const out = bucketByWeek(
      [
        { createdAt: "2026-01-06", quantity: 3 },
        { createdAt: "2026-01-08", quantity: 7 },
      ],
      "2026-01-05",
      "2026-01-12"
    );
    const mon = out.find((p) => p.weekStart === "2026-01-05");
    expect(mon?.qty).toBe(10);
  });
});

function weeklySeries(weeks: number, qty: number): WeeklyDataPoint[] {
  const start = new Date("2026-01-05");
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i * 7);
    return { weekStart: d.toISOString().slice(0, 10), qty };
  });
}

describe("forecastDemand", () => {
  it("returns the requested horizon", () => {
    const out = forecastDemand(weeklySeries(12, 10), { horizon: 4, seasonal: false });
    expect(out).toHaveLength(4);
  });

  it("flat series predicts roughly the same value", () => {
    const out = forecastDemand(weeklySeries(12, 20), { horizon: 2, seasonal: false });
    out.forEach((p) => expect(p.forecast).toBeCloseTo(20, 0));
    out.forEach((p) => expect(p.lower).toBeLessThanOrEqual(p.forecast));
    out.forEach((p) => expect(p.upper).toBeGreaterThanOrEqual(p.forecast));
  });

  it("returns empty when series is empty", () => {
    expect(forecastDemand([], { horizon: 4 })).toEqual([]);
  });
});
