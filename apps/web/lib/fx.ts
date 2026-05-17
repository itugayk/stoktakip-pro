/**
 * Foreign exchange helper. Pulls daily TRY rates from frankfurter.app and caches
 * them in-process for 6 hours; falls back to a hard-coded value of 1.0 on
 * failure so multi-currency forms still render.
 *
 * The list of supported codes is short on purpose — adding more is a one-line
 * change but keeps the dropdown manageable.
 */

export const CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

interface RateCache {
  base: Currency;
  rates: Partial<Record<Currency, number>>;
  fetchedAt: number;
}

const TTL_MS = 6 * 60 * 60 * 1000; // 6h
let cache: RateCache | null = null;

/**
 * Returns how many `base` units make 1 `quote`. Always normalised so that
 * `getRate("USD", "TRY")` is ~33 (the price of one dollar in lira).
 */
export async function getRate(base: Currency, quote: Currency): Promise<number> {
  if (base === quote) return 1;

  const now = Date.now();
  if (!cache || cache.base !== "TRY" || now - cache.fetchedAt > TTL_MS) {
    cache = await fetchRates();
  }

  // We cache base=TRY. So:
  //   getRate(USD, TRY) = 1 / cache.rates.USD       (rates.USD = USDs per TRY)
  //   getRate(TRY, USD) = cache.rates.USD
  //   getRate(USD, EUR) = (1 / cache.rates.USD) * cache.rates.EUR
  const r = cache.rates;
  const usdPerOneOfBase = base === "TRY" ? 1 : 1 / (r[base] ?? 1);
  const quotePerOneOfBase = quote === "TRY" ? 1 : (r[quote] ?? 1);
  return usdPerOneOfBase * quotePerOneOfBase;
}

/** Convert an amount, returning a rounded 2-decimal value. */
export async function convert(amount: number, from: Currency, to: Currency): Promise<number> {
  if (from === to) return amount;
  const rate = await getRate(from, to);
  return Math.round(amount * rate * 100) / 100;
}

async function fetchRates(): Promise<RateCache> {
  const fallback: RateCache = {
    base: "TRY",
    rates: { TRY: 1, USD: 0.029, EUR: 0.027, GBP: 0.023 },
    fetchedAt: Date.now(),
  };
  try {
    // Frankfurter is free, no auth, ECB-sourced.
    const params = CURRENCIES.filter((c) => c !== "TRY").join(",");
    const res = await fetch(`https://api.frankfurter.app/latest?from=TRY&to=${params}`, {
      // Force a fresh fetch on cold start; subsequent calls hit our in-process cache.
      next: { revalidate: TTL_MS / 1000 },
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { rates: Partial<Record<Currency, number>> };
    return {
      base: "TRY",
      rates: { TRY: 1, ...json.rates },
      fetchedAt: Date.now(),
    };
  } catch {
    return fallback;
  }
}

/** Common formatter for TRY-equivalent display. */
export function formatCurrency(amount: number, currency: Currency = "TRY"): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(amount);
}
