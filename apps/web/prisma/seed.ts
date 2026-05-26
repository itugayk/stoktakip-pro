/**
 * StokTakip Pro — initial seed
 *
 * Creates a single company + admin user. Demo content (categories, sample
 * products, warehouses) is intentionally NOT included — fill that in from the
 * UI for the actual use case (Kitap Dağıtım: schools, books, class/branch).
 *
 * Usage:
 *   pnpm --dir apps/web exec tsx prisma/seed.ts
 *
 * Env required:
 *   DATABASE_URL (any Postgres URL with write access)
 *   SEED_ADMIN_EMAIL (defaults to "admin@stoktakip.local")
 *   SEED_ADMIN_PASSWORD (defaults to a random string printed at the end)
 *   SEED_COMPANY_NAME (defaults to "Kitap Dağıtım")
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function randomPassword() {
  return randomBytes(12).toString("base64url");
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "itugayk@gmail.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? randomPassword();
  const companyName = process.env.SEED_COMPANY_NAME ?? "Kitap Dağıtım";
  const fullName = process.env.SEED_ADMIN_NAME ?? "Admin";

  console.log(`→ Seeding company "${companyName}" + admin "${email}"...`);

  // Make seed idempotent — if the email already exists, refuse rather than
  // silently re-creating. Caller can wipe with `prisma migrate reset`.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ User ${email} already exists (id=${existing.id}). Skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const company = await prisma.company.create({
    data: {
      name: companyName,
      slug: companyName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/ı/g, "i")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      subscriptionPlan: "professional",
      isActive: true,
    },
  });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role: "admin",
      isActive: true,
      companyId: company.id,
    },
  });

  console.log("✓ Seed complete");
  console.log("  Company ID :", company.id);
  console.log("  User ID    :", user.id);
  console.log("  Email      :", email);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log("  Password   :", password, "  ← save this, won't be shown again");
  } else {
    console.log("  Password   :", "(provided via SEED_ADMIN_PASSWORD)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
