import { signOut } from "@/lib/auth";

// Bulletproof logout: a plain GET endpoint. Any `<a href="/logout">` (no JS,
// no hydration, no dropdown) clears the session cookie and lands on /login.
export async function GET() {
  return await signOut({ redirectTo: "/login" });
}
