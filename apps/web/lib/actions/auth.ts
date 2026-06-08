"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "@/lib/email";
import { Prisma } from "@prisma/client";
import { auth, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail, parseInput, z, type Result } from "@/lib/server";
import type { BusinessType, ModuleKey } from "@/lib/modules/registry";
import {
  resolveBusinessType,
  resolveEnabledModules,
  type CompanySettings,
} from "@/lib/company/settings";

// ============================================
// SIGN IN
// ============================================
const signInSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin"),
  password: z.string().min(1, "Şifre zorunlu"),
});

export async function signIn(
  formData: z.input<typeof signInSchema>
): Promise<Result<{ ok: true }>> {
  let data: z.infer<typeof signInSchema>;
  try {
    data = parseInput(signInSchema, formData);
  } catch (e) {
    const err = e as { code: string; message: string; field?: string };
    return fail(err.code, err.message, err.field);
  }

  try {
    await nextAuthSignIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
  } catch (e) {
    // NextAuth throws CredentialsSignin on bad creds (its only structured error here)
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("CredentialsSignin") || msg.includes("credentials")) {
      return fail("invalid_credentials", "E-posta veya şifre hatalı");
    }
    return fail("invalid_credentials", "E-posta veya şifre hatalı");
  }

  revalidatePath("/", "layout");
  return ok({ ok: true });
}

// ============================================
// SIGN UP
// ============================================
const signUpSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
  fullName: z.string().min(1, "Ad soyad zorunlu"),
  companyName: z.string().min(1, "Şirket adı zorunlu"),
});

export async function signUp(
  formData: z.input<typeof signUpSchema>
): Promise<Result<{ ok: true }>> {
  let data: z.infer<typeof signUpSchema>;
  try {
    data = parseInput(signUpSchema, formData);
  } catch (e) {
    const err = e as { code: string; message: string; field?: string };
    return fail(err.code, err.message, err.field);
  }

  const email = data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return fail("email_taken", "Bu e-posta adresi zaten kayıtlı", "email");
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const slug = await uniqueSlug(slugify(data.companyName));

  try {
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: data.companyName,
          slug,
          subscriptionPlan: "free",
          isActive: true,
        },
        select: { id: true },
      });

      await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName: data.fullName,
          role: "admin",
          companyId: company.id,
          isActive: true,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = e.meta?.target;
      const fields = Array.isArray(target) ? target : [target ?? ""];
      if (fields.includes("slug")) {
        return fail("company_taken", "Bu şirket adı zaten kullanılıyor", "companyName");
      }
      if (fields.includes("email")) {
        return fail("email_taken", "Bu e-posta adresi zaten kayıtlı", "email");
      }
    }
    return fail("signup_failed", "Kayıt sırasında bir hata oluştu");
  }

  // Auto sign-in after signup
  try {
    await nextAuthSignIn("credentials", {
      email,
      password: data.password,
      redirect: false,
    });
  } catch {
    // If auto sign-in fails, user can still log in manually
  }

  revalidatePath("/", "layout");
  return ok({ ok: true });
}

// ============================================
// SIGN OUT
// ============================================
export async function signOut() {
  await nextAuthSignOut({ redirect: false });
  revalidatePath("/", "layout");
  redirect("/login");
}

// ============================================
// PASSWORD RESET — request
// ============================================
const forgotPasswordSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin"),
});

export async function requestPasswordReset(
  formData: z.input<typeof forgotPasswordSchema>
): Promise<Result<{ ok: true }>> {
  let data: z.infer<typeof forgotPasswordSchema>;
  try {
    data = parseInput(forgotPasswordSchema, formData);
  } catch (e) {
    const err = e as { code: string; message: string; field?: string };
    return fail(err.code, err.message, err.field);
  }

  const email = data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  });

  // Always respond identically whether or not the account exists, so the form
  // can't be used to enumerate registered e-mails.
  if (user && user.isActive) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any prior unused tokens for this user, then issue a fresh one.
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, hashedToken, expiresAt },
    });

    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "stok.panel.dijifa.com";
    const proto = h.get("x-forwarded-proto") ?? "https";
    const resetUrl = `${proto}://${host}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(email, resetUrl);
    } catch (err) {
      // Don't leak failures to the client (anti-enumeration); log for ops.
      console.error("[password-reset] e-posta gönderilemedi:", err);
    }
  }

  return ok({ ok: true });
}

// ============================================
// PASSWORD RESET — confirm
// ============================================
const resetPasswordSchema = z.object({
  token: z.string().min(1, "Geçersiz bağlantı"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı"),
});

export async function resetPassword(
  formData: z.input<typeof resetPasswordSchema>
): Promise<Result<{ ok: true }>> {
  let data: z.infer<typeof resetPasswordSchema>;
  try {
    data = parseInput(resetPasswordSchema, formData);
  } catch (e) {
    const err = e as { code: string; message: string; field?: string };
    return fail(err.code, err.message, err.field);
  }

  const hashedToken = crypto.createHash("sha256").update(data.token).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({
    where: { hashedToken },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return fail(
      "invalid_token",
      "Bağlantı geçersiz veya süresi dolmuş. Lütfen yeni bir sıfırlama talebi oluşturun."
    );
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Drop any other outstanding (still-unused) tokens for this user.
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    }),
  ]);

  return ok({ ok: true });
}

// ============================================
// GET CURRENT USER (profile + company)
// ============================================
export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "manager" | "warehouse_staff" | "viewer";
  avatarUrl?: string;
  company: {
    id: string;
    name: string;
    businessType: BusinessType;
    enabledModules: ModuleKey[];
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Pull fresh profile + company (incl. settings for module gating) in one trip.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      avatarUrl: true,
      company: { select: { id: true, name: true, settings: true } },
    },
  });
  if (!user) return null;

  const settings = (user.company.settings as CompanySettings | null) ?? {};

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    avatarUrl: user.avatarUrl ?? undefined,
    company: {
      id: user.company.id,
      name: user.company.name,
      businessType: resolveBusinessType(settings),
      enabledModules: resolveEnabledModules(settings),
    },
  };
}

// ============================================
// Helpers
// ============================================
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const existing = await prisma.company.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  if (existing.length === 0) return base;
  const taken = new Set(existing.map((c) => c.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
