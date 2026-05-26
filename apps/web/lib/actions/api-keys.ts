"use server";

import { withCompany, withRole, ok, parseInput, z, ERR } from "@/lib/server";
import { hashToken, tokenPrefix } from "@/lib/api/auth";

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
}

function generateToken(): string {
  const r = (n: number) => {
    let out = "";
    while (out.length < n) out += Math.random().toString(36).slice(2);
    return out.slice(0, n);
  };
  return `sk_live_${r(32)}`;
}

export const listApiKeys = withCompany<void, ApiKey[]>(async (ctx) => {
  const rows = await ctx.prisma.apiKey.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      scopes: r.scopes ?? [],
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt?.toISOString() ?? undefined,
      revokedAt: r.revokedAt?.toISOString() ?? undefined,
      expiresAt: r.expiresAt?.toISOString() ?? undefined,
    }))
  );
});

const createSchema = z.object({
  name: z.string().min(1, "Ad zorunlu"),
  scopes: z.array(z.enum(["read", "write", "admin"])).min(1),
  expiresAt: z.string().optional(),
});

/** Only admin can mint API keys. Returns the raw token ONCE. */
export const createApiKey = withRole<
  z.input<typeof createSchema>,
  { token: string; key: ApiKey }
>(["admin"], async (ctx, raw) => {
  const data = parseInput(createSchema, raw);
  const token = generateToken();

  const row = await ctx.prisma.apiKey.create({
    data: {
      companyId: ctx.companyId,
      name: data.name,
      prefix: tokenPrefix(token),
      hashedToken: hashToken(token),
      scopes: data.scopes,
      createdById: ctx.userId,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });

  return ok({
    token,
    key: {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      scopes: row.scopes,
      createdAt: row.createdAt.toISOString(),
    },
  });
});

export const revokeApiKey = withRole<string, void>(["admin"], async (ctx, id) => {
  const res = await ctx.prisma.apiKey.updateMany({
    where: { id, companyId: ctx.companyId },
    data: { revokedAt: new Date() },
  });
  if (res.count === 0) throw ERR.notFound("API anahtarı");
  return ok();
});
