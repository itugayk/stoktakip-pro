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
  if (ctx.demo) {
    return ok([
      {
        id: "demo-1",
        name: "Demo Key",
        prefix: "sk_live_demo",
        scopes: ["read", "write"],
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  const { data, error } = await ctx.supabase
    .from("api_keys")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw ERR.database(error.message);

  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      scopes: r.scopes ?? [],
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at ?? undefined,
      revokedAt: r.revoked_at ?? undefined,
      expiresAt: r.expires_at ?? undefined,
    }))
  );
});

const createSchema = z.object({
  name: z.string().min(1, "Ad zorunlu"),
  scopes: z.array(z.enum(["read", "write", "admin"])).min(1),
  expiresAt: z.string().optional(),
});

/** Only admin can mint API keys. Returns the raw token ONCE. */
export const createApiKey = withRole<z.input<typeof createSchema>, { token: string; key: ApiKey }>(
  ["admin"],
  async (ctx, raw) => {
    const data = parseInput(createSchema, raw);
    if (ctx.demo) {
      return ok({
        token: "sk_live_demo_" + Date.now().toString(36),
        key: {
          id: "demo",
          name: data.name,
          prefix: "sk_live_demo",
          scopes: data.scopes,
          createdAt: new Date().toISOString(),
        },
      });
    }

    const token = generateToken();
    const { data: row, error } = await ctx.supabase
      .from("api_keys")
      .insert({
        company_id: ctx.companyId,
        name: data.name,
        prefix: tokenPrefix(token),
        hashed_token: hashToken(token),
        scopes: data.scopes,
        created_by: ctx.userId,
        expires_at: data.expiresAt ?? null,
      } as never)
      .select("*")
      .single();
    if (error) throw ERR.database(error.message);

    return ok({
      token,
      key: {
        id: row.id,
        name: row.name,
        prefix: row.prefix,
        scopes: row.scopes,
        createdAt: row.created_at,
      },
    });
  }
);

export const revokeApiKey = withRole<string, void>(["admin"], async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});
