import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { log } from "@/lib/log";

/**
 * Public API key authentication.
 *
 * Tokens are formatted as `sk_live_<32-char-base36>`. We hash with SHA-256
 * before lookup, so the raw token only exists in transit (and briefly in the
 * UI right after creation).
 */

export interface ApiContext {
  companyId: string;
  keyId: string;
  scopes: string[];
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenPrefix(token: string): string {
  return token.slice(0, 12);
}

/**
 * Verify the `Authorization: Bearer <token>` header and return the company
 * + scopes. Uses the service-role client because we're authenticating the
 * caller — not acting on behalf of a logged-in user.
 */
export async function authenticateRequest(req: Request): Promise<
  | { ok: true; ctx: ApiContext }
  | { ok: false; status: number; error: string }
> {
  const header = req.headers.get("authorization");
  if (!header) return { ok: false, status: 401, error: "missing_authorization" };

  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return { ok: false, status: 401, error: "invalid_authorization" };

  const token = match[1];
  if (!token.startsWith("sk_")) return { ok: false, status: 401, error: "malformed_token" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // Demo mode — accept a demo token so the API stays explorable.
    if (token === "sk_live_demo") {
      return { ok: true, ctx: { companyId: "demo-company", keyId: "demo", scopes: ["read", "write"] } };
    }
    return { ok: false, status: 503, error: "auth_not_configured" };
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, company_id, scopes, revoked_at, expires_at")
    .eq("hashed_token", hashToken(token))
    .maybeSingle();

  if (error || !data) return { ok: false, status: 401, error: "invalid_token" };
  if (data.revoked_at) return { ok: false, status: 401, error: "revoked" };
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { ok: false, status: 401, error: "expired" };
  }

  // Touch last_used_at (fire-and-forget — don't block the request).
  void supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(({ error: e }) => {
      if (e) log.warn("failed to update api_key.last_used_at", { id: data.id });
    });

  return {
    ok: true,
    ctx: {
      companyId: data.company_id,
      keyId: data.id,
      scopes: (data.scopes ?? []) as string[],
    },
  };
}

export function requireScope(ctx: ApiContext, scope: string): boolean {
  return ctx.scopes.includes(scope) || ctx.scopes.includes("admin");
}

/** Standard JSON helpers for v1 routes. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function errorResponse(status: number, code: string, message?: string): Response {
  return json({ error: { code, message: message ?? code } }, status);
}
