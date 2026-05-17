import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS — use only on the server, only
 * after authenticating the caller (e.g. via an API key or webhook signature).
 *
 * Throws when env vars are missing so callers must consciously gate by
 * `DEMO_MODE` first if they want a soft-fail.
 */
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY missing — service client unavailable");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
