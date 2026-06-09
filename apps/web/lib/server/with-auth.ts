import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";
import type { UserRole } from "@/lib/types";
import { log } from "@/lib/log";
import { AppError, ERR } from "./errors";
import { ok, fail, type Result } from "./result";

export interface AuthCtx {
  userId: string;
  companyId: string;
  role: UserRole;
  /**
   * Warehouses this user is restricted to. Only populated for `warehouse_staff`;
   * empty for roles that see every warehouse (admin/manager/viewer). Use
   * `warehouseScope(ctx)` to turn this into a query filter.
   */
  warehouseIds: string[];
  prisma: PrismaClient;
  /** Always false now that Supabase + demo mode are gone. Kept for backwards compat. */
  demo: false;
}

async function resolveCtx(): Promise<AuthCtx> {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) throw ERR.unauthorized();

  const role = session.user.role as UserRole;

  // Warehouse staff are scoped to their assigned warehouses. We read this fresh
  // from the DB (not the JWT) so re-assignments take effect without re-login.
  let warehouseIds: string[] = [];
  if (role === "warehouse_staff") {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { warehouseIds: true },
    });
    warehouseIds = u?.warehouseIds ?? [];
  }

  return {
    userId: session.user.id,
    companyId: session.user.companyId,
    role,
    warehouseIds,
    prisma,
    demo: false,
  };
}

/**
 * Returns the set of warehouse ids the current user may see, or `null` when the
 * user is unrestricted (admin/manager/viewer). A `warehouse_staff` with no
 * assigned warehouses returns `[]`, which callers should treat as "see nothing".
 */
export function warehouseScope(ctx: AuthCtx): string[] | null {
  return ctx.role === "warehouse_staff" ? ctx.warehouseIds : null;
}

function handleError(e: unknown): Result<never> {
  if (e instanceof AppError) {
    if (e.code !== "validation" && e.code !== "unauthorized") {
      log.warn(`action: ${e.code}`, { message: e.message, field: e.field });
    }
    return fail(e.code, e.message, e.field);
  }
  // Engine errors (insufficient stock, bad movement config) carry a typed `code`
  // and a user-facing Turkish message — surface them as clean failures.
  if (
    e !== null &&
    typeof e === "object" &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    e instanceof Error
  ) {
    return fail((e as { code: string }).code, e.message);
  }
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
      if (!roles.includes(ctx.role)) {
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
