import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";
import { log } from "@/lib/log";
import { AppError, ERR } from "./errors";
import { ok, fail, type Result } from "./result";

const DEMO_MODE =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface AuthCtx {
  userId: string;
  companyId: string;
  role: UserRole;
  supabase: SupabaseServerClient;
  demo: boolean;
}

/**
 * Demo context shared by all HOFs when env vars are placeholders.
 * Keeps demo paths consistent with real-auth call sites.
 */
const DEMO_CTX: Omit<AuthCtx, "supabase"> = {
  userId: "demo-user",
  companyId: "demo-company",
  role: "admin",
  demo: true,
};

async function resolveCtx(): Promise<AuthCtx> {
  if (DEMO_MODE) {
    return { ...DEMO_CTX, supabase: null as unknown as SupabaseServerClient };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw ERR.unauthorized();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", userData.user.id)
    .single();

  if (error || !profile) throw ERR.notFound("Profil");

  return {
    userId: userData.user.id,
    companyId: profile.company_id,
    role: profile.role as UserRole,
    supabase,
    demo: false,
  };
}

function handleError(e: unknown): Result<never> {
  if (e instanceof AppError) {
    // Expected operational failures (validation, auth, etc.) are info-level —
    // they're part of normal flow and surface to the user via Result.
    if (e.code !== "validation" && e.code !== "unauthorized") {
      log.warn(`action: ${e.code}`, { message: e.message, field: e.field });
    }
    return fail(e.code, e.message, e.field);
  }
  // Unexpected: log full error with stack for triage.
  log.error(e, { source: "withAuth" });
  const msg = e instanceof Error ? e.message : "Beklenmeyen bir hata oluştu";
  return fail("internal", msg);
}

/** Run an action with an authenticated context. */
export function withAuth<I, T>(
  action: (ctx: AuthCtx, input: I) => Promise<Result<T>> | Promise<T>
): (input: I) => Promise<Result<T>> {
  return async (input: I) => {
    try {
      const ctx = await resolveCtx();
      const res = await action(ctx, input);
      return isResult<T>(res) ? res : ok(res);
    } catch (e) {
      return handleError(e);
    }
  };
}

/** Run an action, requiring one of the given roles. */
export function withRole<I, T>(
  roles: UserRole[],
  action: (ctx: AuthCtx, input: I) => Promise<Result<T>> | Promise<T>
): (input: I) => Promise<Result<T>> {
  return async (input: I) => {
    try {
      const ctx = await resolveCtx();
      if (!ctx.demo && !roles.includes(ctx.role)) {
        throw ERR.forbidden();
      }
      const res = await action(ctx, input);
      return isResult<T>(res) ? res : ok(res);
    } catch (e) {
      return handleError(e);
    }
  };
}

/**
 * Alias for `withAuth` — explicit at call sites where the action writes
 * company-scoped data and relies on `ctx.companyId`.
 */
export const withCompany = withAuth;

function isResult<T>(v: unknown): v is Result<T> {
  return (
    typeof v === "object" &&
    v !== null &&
    "ok" in v &&
    typeof (v as { ok: unknown }).ok === "boolean"
  );
}
