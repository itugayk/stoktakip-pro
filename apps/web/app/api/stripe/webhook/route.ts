import { createHmac, timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/supabase/service";
import { log } from "@/lib/log";

/**
 * Stripe webhook receiver. Verifies the signature, then updates the
 * companies.subscription_plan / subscription_expires_at based on the event.
 *
 * To wire up: in Stripe Dashboard → Developers → Webhooks, add this URL and
 * subscribe to: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted, invoice.payment_failed.
 */

const TOLERANCE_S = 300;

function verifyStripeSignature(header: string | null, body: string, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    })
  );
  const ts = Number(parts.t);
  const sig = parts.v1;
  if (!Number.isFinite(ts) || !sig) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > TOLERANCE_S) return false;
  const expected = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ error: "stripe_not_configured" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!verifyStripeSignature(signature, body, secret)) {
    log.warn("stripe webhook bad signature");
    return new Response("invalid signature", { status: 401 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const supabase = serviceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          client_reference_id?: string;
          customer?: string;
          subscription?: string;
          metadata?: { plan?: string };
        };
        if (session.client_reference_id && session.metadata?.plan) {
          await supabase
            .from("companies")
            .update({
              subscription_plan: session.metadata.plan,
            })
            .eq("id", session.client_reference_id);
          log.info("stripe checkout completed", { companyId: session.client_reference_id });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as {
          status: string;
          current_period_end?: number;
          metadata?: { companyId?: string };
        };
        if (sub.metadata?.companyId) {
          const updates: Record<string, unknown> = {};
          if (sub.status === "canceled") updates.subscription_plan = "free";
          if (sub.current_period_end) {
            updates.subscription_expires_at = new Date(sub.current_period_end * 1000).toISOString();
          }
          if (Object.keys(updates).length > 0) {
            await supabase.from("companies").update(updates).eq("id", sub.metadata.companyId);
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as { metadata?: { companyId?: string } };
        if (invoice.metadata?.companyId) {
          log.warn("payment failed", { companyId: invoice.metadata.companyId });
          // Could trigger an in-app notification here.
        }
        break;
      }
      default:
        log.info(`unhandled stripe event: ${event.type}`);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    log.error(e, { context: "stripe_webhook" });
    return new Response("server error", { status: 500 });
  }
}
