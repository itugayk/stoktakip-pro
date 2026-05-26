import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

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
 * + scopes.
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
  if (!token.startsWith("sk_"))
    return { ok: false, status: 401, error: "malformed_token" };

  const row = await prisma.apiKey.findUnique({
    where: { hashedToken: hashToken(token) },
    select: {
      id: true,
      companyId: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
    },
  });

  if (!row) return { ok: false, status: 401, error: "invalid_token" };
  if (row.revokedAt) return { ok: false, status: 401, error: "revoked" };
  if (row.expiresAt && row.expiresAt < new Date()) {
    return { ok: false, status: 401, error: "expired" };
  }

  // Touch last_used_at (fire-and-forget).
  void prisma.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    ok: true,
    ctx: {
      companyId: row.companyId,
      keyId: row.id,
      scopes: row.scopes ?? [],
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

export function errorResponse(
  status: number,
  code: string,
  message?: string
): Response {
  return json({ error: { code, message: message ?? code } }, status);
}
