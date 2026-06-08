import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

/**
 * Full NextAuth config — Node runtime only.
 * Imports Prisma + bcrypt; do NOT import from middleware/Edge code.
 *
 * Edge code (middleware) imports from `auth.config.ts` instead.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Kullanıcı adı veya e-posta", type: "text" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        const identifier = credentials?.identifier;
        const password = credentials?.password;
        if (typeof identifier !== "string" || typeof password !== "string") {
          return null;
        }

        const id = identifier.toLowerCase().trim();
        const user = await prisma.user.findFirst({
          where: { OR: [{ email: id }, { username: id }] },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            fullName: true,
            companyId: true,
            role: true,
            isActive: true,
            emailVerified: true,
          },
        });

        // Reject: missing, no password, disabled, or e-mail not verified.
        if (!user || !user.passwordHash || !user.isActive || !user.emailVerified) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Update last_login_at fire-and-forget; failure here shouldn't block login.
        prisma.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          .catch(() => {});

        // The returned object becomes the `user` arg of the jwt callback.
        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          fullName: user.fullName,
          companyId: user.companyId,
          role: user.role,
        };
      },
    }),
  ],
});
