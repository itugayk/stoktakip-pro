import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase Auth Callback Handler
 * Handles email confirmation and OAuth redirects.
 * Currently in demo mode — will activate with real Supabase project.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch {
      // Supabase not configured — redirect to login
    }
  }

  // If no code or error, redirect to login
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
