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
    // Exclude:
    //  - Next.js internals (_next/static, _next/image)
    //  - Static assets (icons, images)
    //  - PWA assets (manifest.json, sw.js, *.webmanifest)
    //  - Auth API (NextAuth handles its own routing)
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|robots\\.txt|sitemap\\.xml|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
