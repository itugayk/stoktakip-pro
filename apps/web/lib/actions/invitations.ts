"use server";

import { withRole, withAuth, ok, fail, parseInput, z, ERR } from "@/lib/server";
import type { UserRole } from "@/lib/types";

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  warehouseIds: string[];
  token: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

const createSchema = z.object({
  email: z.string().email("Geçerli e-posta girin"),
  role: z.enum(["admin", "manager", "warehouse_staff", "viewer"]),
  warehouseIds: z.array(z.string()).optional(),
});

function randomToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export const listInvitations = withAuth<void, Invitation[]>(async (ctx) => {
  if (ctx.demo) return ok([]);

  const { data, error } = await ctx.supabase
    .from("invitations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw ERR.database(error.message);

  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role as UserRole,
      warehouseIds: r.warehouse_ids ?? [],
      token: r.token,
      expiresAt: r.expires_at,
      acceptedAt: r.accepted_at ?? undefined,
      createdAt: r.created_at,
    }))
  );
});

/** Only admin can invite. */
export const createInvitation = withRole<z.input<typeof createSchema>, { token: string }>(
  ["admin"],
  async (ctx, raw) => {
    const data = parseInput(createSchema, raw);
    if (ctx.demo) return ok({ token: "demo-token-" + Date.now() });

    // Check user limit before issuing the invite.
    const { data: company } = await ctx.supabase
      .from("companies")
      .select("max_users, subscription_limits")
      .eq("id", ctx.companyId)
      .single();
    const limits = (company?.subscription_limits as { maxUsers?: number } | null) ?? {};
    const hardLimit = limits.maxUsers ?? company?.max_users ?? null;
    if (hardLimit !== null) {
      const { count: userCount } = await ctx.supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", ctx.companyId);
      const { count: pendingCount } = await ctx.supabase
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .eq("company_id", ctx.companyId)
        .is("accepted_at", null);
      if ((userCount ?? 0) + (pendingCount ?? 0) >= hardLimit) {
        return fail("plan_limit", `Plan kullanıcı sınırına ulaştınız (${hardLimit}).`);
      }
    }

    const token = randomToken();
    const { error } = await ctx.supabase
      .from("invitations")
      .upsert(
        {
          company_id: ctx.companyId,
          email: data.email.toLowerCase(),
          role: data.role,
          warehouse_ids: data.warehouseIds ?? null,
          token,
          invited_by: ctx.userId,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        } as never,
        { onConflict: "company_id,email" }
      );
    if (error) throw ERR.database(error.message);

    // The actual email send happens in an Edge function / Resend integration —
    // for now we expose the token so the admin can copy the magic link.
    return ok({ token });
  }
);

export const revokeInvitation = withRole<string, void>(["admin"], async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase
    .from("invitations")
    .delete()
    .eq("id", id)
    .is("accepted_at", null);
  if (error) throw ERR.database(error.message);
  return ok();
});

const acceptSchema = z.object({ token: z.string() });

export const acceptInvitation = withAuth<z.input<typeof acceptSchema>, { companyId: string }>(
  async (ctx, raw) => {
    const { token } = parseInput(acceptSchema, raw);
    if (ctx.demo) return ok({ companyId: "demo" });

    const { data: inv, error: readErr } = await ctx.supabase
      .from("invitations")
      .select("id, company_id, email, role, warehouse_ids, expires_at, accepted_at")
      .eq("token", token)
      .maybeSingle();
    if (readErr) throw ERR.database(readErr.message);
    if (!inv) return fail("not_found", "Geçersiz davet kodu");
    if (inv.accepted_at) return fail("already_accepted", "Bu davet zaten kullanılmış");
    if (new Date(inv.expires_at) < new Date()) return fail("expired", "Davet süresi dolmuş");

    // Update current user's profile to match the invite.
    const { error: updErr } = await ctx.supabase
      .from("profiles")
      .update({
        company_id: inv.company_id,
        role: inv.role,
        warehouse_ids: inv.warehouse_ids,
      } as never)
      .eq("id", ctx.userId);
    if (updErr) throw ERR.database(updErr.message);

    await ctx.supabase
      .from("invitations")
      .update({ accepted_at: new Date().toISOString(), accepted_by: ctx.userId })
      .eq("id", inv.id);

    return ok({ companyId: inv.company_id });
  }
);
