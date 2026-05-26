import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth config — no Prisma, no bcrypt, no Node-only imports.
 * Used by the middleware (`proxy.ts`) which runs on the Edge runtime.
 * The full config (with the Credentials provider) lives in `lib/auth.ts`
 * and is consumed by route handlers + server actions.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  providers: [], // Filled in lib/auth.ts (Node runtime)
  callbacks: {
    /**
     * Middleware authorization gate. Returns:
     *  - true  → allow
     *  - false → redirect to signIn page
     *  - Response.redirect(...) → custom redirect
     */
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = Boolean(auth?.user);
      const isAuthPage =
        pathname.startsWith("/login") || pathname.startsWith("/register");
      const isPublic =
        pathname === "/" ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next");

      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL("/dashboard", request.url));
      }

      if (!isLoggedIn && !isAuthPage && !isPublic) {
        // false here triggers a redirect to `pages.signIn`.
        return false;
      }

      return true;
    },
    /**
     * `jwt` and `session` callbacks live here so they apply to both Edge
     * (middleware) and Node (server actions) flows. The token is populated
     * once at sign-in by lib/auth.ts; here we only forward it.
     */
    async jwt({ token, user }) {
      if (user) {
        // `user` is the object returned by Credentials.authorize().
        // We attach the company-scoped fields so subsequent middleware
        // reads can decide auth without hitting the DB.
        const u = user as typeof user & {
          companyId?: string;
          role?: string;
          fullName?: string;
        };
        if (u.companyId) token.companyId = u.companyId;
        if (u.role) token.role = u.role;
        if (u.fullName) token.fullName = u.fullName;
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = token.uid as string;
        session.user.companyId = (token.companyId as string) ?? "";
        session.user.role =
          ((token.role as string) ?? "viewer") as typeof session.user.role;
        session.user.fullName = (token.fullName as string) ?? "";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
