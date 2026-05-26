import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * Edge-runtime middleware. Uses the Edge-safe NextAuth config
 * (no Prisma, no bcrypt). Login/logout state comes from the JWT cookie.
 *
 * Exported as `proxy` — Next.js 16+ renamed the middleware export.
 */
const { auth } = NextAuth(authConfig);
export const proxy = auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
