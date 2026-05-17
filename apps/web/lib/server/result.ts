/**
 * Discriminated Result<T> for server actions.
 *
 * On the server: return `ok(data)` or `fail(code, message, field?)`.
 * On the client: discriminate with `if (!res.ok)` for type-narrowing access
 * to `res.error.message`.
 */
export type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ResultError };

export interface ResultError {
  /** Stable identifier for i18n / telemetry (e.g. "unauthorized", "validation"). */
  code: string;
  /** Human-readable message. May come from i18n upstream. */
  message: string;
  /** Optional field name for form-level errors. */
  field?: string;
}

export function ok<T>(data: T): Result<T>;
export function ok(): Result<void>;
export function ok<T>(data?: T): Result<T | void> {
  return { ok: true, data: data as T };
}

export function fail(code: string, message: string, field?: string): Result<never> {
  return { ok: false, error: { code, message, field } };
}

/** Bridge for callers that still expect the legacy `{ success, error? }` shape. */
export function toLegacy<T>(res: Result<T>): { success: boolean; error?: string } {
  return res.ok ? { success: true } : { success: false, error: res.error.message };
}
