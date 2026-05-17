"use client";

import { toast } from "sonner";
import type { Result } from "@/lib/server/result";

/**
 * Result-aware toast helpers.
 *
 * - `notify.error(result)` short-circuits when the action failed and surfaces
 *   `result.error.message`; safe to call with a successful Result (no-op).
 * - `notify.handle(result, onOk, successMsg?)` — common pattern: run a side
 *   effect on success, show error toast on failure.
 */

export const notify = {
  success: (message: string, description?: string) =>
    toast.success(message, description ? { description } : undefined),

  warn: (message: string, description?: string) =>
    toast.warning(message, description ? { description } : undefined),

  /** Render a toast for a failed Result. No-op on success. */
  error<T>(result: Result<T> | string, fallback = "Bir hata oluştu") {
    if (typeof result === "string") {
      toast.error(result);
      return;
    }
    if (result.ok) return;
    toast.error(result.error.message || fallback);
  },

  /**
   * Branch on a Result and toast accordingly.
   * Returns true if success path ran, false otherwise — useful in submit handlers.
   */
  handle<T>(
    result: Result<T>,
    onOk: (data: T) => void,
    successMsg?: string
  ): boolean {
    if (result.ok) {
      onOk(result.data);
      if (successMsg) toast.success(successMsg);
      return true;
    }
    toast.error(result.error.message);
    return false;
  },
};
