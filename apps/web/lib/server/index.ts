export { ok, fail, toLegacy } from "./result";
export type { Result, ResultError } from "./result";
export { AppError, ERR } from "./errors";
export { parseInput, z } from "./validate";
export { withAuth, withRole, withCompany } from "./with-auth";
export type { AuthCtx } from "./with-auth";
export { logAudit } from "./audit";
export type { AuditAction, AuditEntry } from "./audit";
