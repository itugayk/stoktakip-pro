import { z, type ZodType } from "zod";
import { AppError } from "./errors";

/**
 * Parse + validate input with a Zod schema. Throws `AppError("validation", ...)`
 * on failure so `withAuth`/`withCompany` can surface it as a `Result` failure.
 */
export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const res = schema.safeParse(input);
  if (!res.success) {
    const first = res.error.issues[0];
    const field = first?.path?.join(".");
    throw new AppError("validation", first?.message ?? "Geçersiz veri", field || undefined);
  }
  return res.data;
}

/** Re-export so action files don't need a separate zod import. */
export { z };
