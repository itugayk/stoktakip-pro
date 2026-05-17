/**
 * Stripe subscription scaffold. Real network calls are gated on
 * STRIPE_SECRET_KEY — without it, every operation returns a safe stub result
 * so the UI can render without crashing.
 *
 * To activate:
 *   1. Set STRIPE_SECRET_KEY + NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
 *   2. Create products + prices in Stripe dashboard (one per plan).
 *   3. Add the price ids to STRIPE_PRICE_<PLAN> env vars.
 *   4. Add the webhook endpoint /api/stripe/webhook to your Stripe dashboard
 *      and set STRIPE_WEBHOOK_SECRET.
 */

export type Plan = "free" | "starter" | "professional" | "enterprise";

export const PLAN_PRICE_IDS: Record<Plan, { monthly?: string; yearly?: string }> = {
  free: {},
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    yearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
  },
  professional: {
    monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
    yearly: process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY,
  },
  enterprise: {},
};

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export interface CheckoutSessionArgs {
  plan: Plan;
  billingPeriod: "monthly" | "yearly";
  customerEmail: string;
  companyId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  ok: boolean;
  url?: string;
  message?: string;
}

/**
 * Create a Stripe Checkout session and return the redirect URL. Returns a
 * stub when Stripe is not configured so callers handle the UI gracefully.
 */
export async function createCheckoutSession(args: CheckoutSessionArgs): Promise<CheckoutSessionResult> {
  if (!isStripeConfigured()) {
    return {
      ok: false,
      message: "Stripe henüz yapılandırılmadı. Ücretsiz plan ile devam edebilirsiniz.",
    };
  }

  const priceId = PLAN_PRICE_IDS[args.plan]?.[args.billingPeriod];
  if (!priceId) {
    return { ok: false, message: "Bu plan için fiyat tanımlanmamış." };
  }

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        mode: "subscription",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        customer_email: args.customerEmail,
        client_reference_id: args.companyId,
        success_url: args.successUrl,
        cancel_url: args.cancelUrl,
        "metadata[plan]": args.plan,
        "metadata[period]": args.billingPeriod,
        "metadata[companyId]": args.companyId,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, message: `Stripe: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { url: string };
    return { ok: true, url: data.url };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}

/**
 * Open a billing portal session so customers can manage their subscription
 * (change plan, update card, cancel).
 */
export async function createPortalSession(customerId: string, returnUrl: string): Promise<CheckoutSessionResult> {
  if (!isStripeConfigured()) {
    return { ok: false, message: "Stripe yapılandırılmadı" };
  }
  try {
    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ customer: customerId, return_url: returnUrl }),
    });
    if (!res.ok) return { ok: false, message: await res.text() };
    const data = (await res.json()) as { url: string };
    return { ok: true, url: data.url };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Bilinmeyen hata" };
  }
}
