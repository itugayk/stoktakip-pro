import { describe, it, expect } from "vitest";
import { planFEFO, InsufficientStockError } from "@/lib/inventory/engine";

describe("planFEFO", () => {
  it("consumes the first (oldest-expiry) lot before later ones", () => {
    // rows arrive already ordered oldest-expiry-first.
    const { takes, shortfall } = planFEFO(
      [{ available: 5 }, { available: 5 }],
      3
    );
    expect(takes).toEqual([3, 0]);
    expect(shortfall).toBe(0);
  });

  it("spills over to the next lot when the first is exhausted", () => {
    const { takes, shortfall } = planFEFO(
      [{ available: 5 }, { available: 5 }],
      8
    );
    expect(takes).toEqual([5, 3]);
    expect(shortfall).toBe(0);
  });

  it("reports a shortfall when total available is insufficient", () => {
    const { takes, shortfall } = planFEFO(
      [{ available: 2 }, { available: 1 }],
      10
    );
    expect(takes).toEqual([2, 1]);
    expect(shortfall).toBe(7);
  });

  it("skips empty/over-reserved rows (available <= 0)", () => {
    const { takes, shortfall } = planFEFO(
      [{ available: 0 }, { available: -3 }, { available: 4 }],
      4
    );
    expect(takes).toEqual([0, 0, 4]);
    expect(shortfall).toBe(0);
  });

  it("takes nothing when requested is zero", () => {
    const { takes, shortfall } = planFEFO([{ available: 5 }], 0);
    expect(takes).toEqual([0]);
    expect(shortfall).toBe(0);
  });

  it("never takes more than the total available across many lots", () => {
    const rows = [{ available: 3 }, { available: 4 }, { available: 2 }];
    const { takes } = planFEFO(rows, 100);
    const total = takes.reduce((a, b) => a + b, 0);
    expect(total).toBe(9); // 3+4+2 — the whole stock, no more
  });
});

describe("InsufficientStockError", () => {
  it("carries the typed code and quantities for the UI", () => {
    const err = new InsufficientStockError("prod-1", 10, 3, "wh-1");
    expect(err.code).toBe("insufficient_stock");
    expect(err.requested).toBe(10);
    expect(err.available).toBe(3);
    expect(err.message).toContain("Yetersiz stok");
  });
});
