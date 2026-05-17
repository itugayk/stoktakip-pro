/**
 * Server-side typed error.
 *
 * Throw inside actions to short-circuit; HOFs (withAuth/withRole/withCompany)
 * catch these and convert them into a `Result<never>` failure with the same code.
 */
export class AppError extends Error {
  readonly code: string;
  readonly field?: string;

  constructor(code: string, message: string, field?: string) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = "AppError";
  }
}

export const ERR = {
  unauthorized: () => new AppError("unauthorized", "Oturum açmanız gerekiyor"),
  forbidden: (msg = "Bu işlem için yetkiniz yok") => new AppError("forbidden", msg),
  notFound: (what: string) => new AppError("not_found", `${what} bulunamadı`),
  validation: (msg: string, field?: string) => new AppError("validation", msg, field),
  database: (msg: string) => new AppError("database", msg),
  internal: (msg = "Beklenmeyen bir hata oluştu") => new AppError("internal", msg),
} as const;
