"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ok, fail, parseInput, z, type Result } from "@/lib/server";

const DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

// ============================================
// SIGN IN
// ============================================
const signInSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin"),
  password: z.string().min(1, "Şifre zorunlu"),
});

export async function signIn(
  formData: z.input<typeof signInSchema>
): Promise<Result<{ demo?: boolean }>> {
  let data: z.infer<typeof signInSchema>;
  try {
    data = parseInput(signInSchema, formData);
  } catch (e) {
    const err = e as { code: string; message: string; field?: string };
    return fail(err.code, err.message, err.field);
  }

  if (DEMO_MODE) {
    if (data.email === "demo@demo.com" && data.password === "demo") {
      return ok({ demo: true });
    }
    return fail("invalid_credentials", "Hatalı e-posta veya şifre");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    const msg =
      error.message === "Invalid login credentials"
        ? "E-posta veya şifre hatalı"
        : error.message;
    return fail("invalid_credentials", msg);
  }

  revalidatePath("/", "layout");
  return ok({});
}

// ============================================
// SIGN UP
// ============================================
const signUpSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
  fullName: z.string().min(1, "Ad soyad zorunlu"),
  companyName: z.string().optional(),
});

export async function signUp(
  formData: z.input<typeof signUpSchema>
): Promise<Result<{ demo?: boolean; needsConfirmation?: boolean }>> {
  let data: z.infer<typeof signUpSchema>;
  try {
    data = parseInput(signUpSchema, formData);
  } catch (e) {
    const err = e as { code: string; message: string; field?: string };
    return fail(err.code, err.message, err.field);
  }

  if (DEMO_MODE) return ok({ demo: true });

  const supabase = await createClient();

  let companyId: string | undefined;
  if (data.companyName) {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: data.companyName,
        slug: data.companyName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      })
      .select("id")
      .single();

    if (companyError) {
      return fail("database", "Şirket oluşturulamadı: " + companyError.message);
    }
    companyId = company.id;
  }

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.fullName,
        company_id: companyId,
        role: "admin",
      },
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      return fail("email_taken", "Bu e-posta adresi zaten kayıtlı", "email");
    }
    return fail("signup_failed", error.message);
  }

  revalidatePath("/", "layout");
  return ok({ needsConfirmation: false });
}

// ============================================
// SIGN OUT
// ============================================
export async function signOut() {
  if (DEMO_MODE) {
    redirect("/login");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
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
  company: { id: string; name: string };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (DEMO_MODE) {
    return {
      id: "demo-user",
      email: "admin@stoktakip.com",
      fullName: "Demo Admin",
      role: "admin",
      company: { id: "demo-company", name: "Demo Şirketi A.Ş." },
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, company:companies(id, name)")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const company = profile.company as { id: string; name: string };
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile.full_name,
    role: profile.role as CurrentUser["role"],
    avatarUrl: profile.avatar_url ?? undefined,
    company: { id: company.id, name: company.name },
  };
}
