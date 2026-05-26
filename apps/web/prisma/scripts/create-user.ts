/**
 * Tek seferlik kullanıcı + şirket oluşturma scripti.
 *
 * Çalıştırma:
 *   node node_modules/tsx/dist/cli.mjs prisma/scripts/create-user.ts
 *
 * Tüm bilgiler rastgele üretilir; sonuçlar konsola yazdırılır.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function rand(n: number): string {
  return randomBytes(n).toString("base64url").slice(0, n);
}

function pickFirstName(): string {
  const names = [
    "Ahmet", "Mehmet", "Mustafa", "Ali", "Hasan", "Hüseyin",
    "İbrahim", "Ayşe", "Fatma", "Zeynep", "Emine", "Hatice",
    "Elif", "Merve", "Sevgi", "Yasemin",
  ];
  return names[Math.floor(Math.random() * names.length)];
}

function pickLastName(): string {
  const names = [
    "Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız",
    "Yıldırım", "Öztürk", "Aydın", "Arslan", "Doğan", "Kılıç",
  ];
  return names[Math.floor(Math.random() * names.length)];
}

async function main() {
  const suffix = rand(6).toLowerCase();
  const fullName = `${pickFirstName()} ${pickLastName()}`;
  const email = `kullanici-${suffix}@test.local`;
  const password = rand(16);
  const companyName = `Test Şirketi ${rand(4).toUpperCase()}`;
  const slug = companyName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const passwordHash = await bcrypt.hash(password, 12);

  console.log("→ Yeni şirket + admin oluşturuluyor...");

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        slug,
        subscriptionPlan: "professional",
        isActive: true,
      },
      select: { id: true, name: true },
    });

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        role: "admin",
        isActive: true,
        companyId: company.id,
      },
      select: { id: true, email: true, fullName: true },
    });

    return { company, user };
  });

  console.log("\n✓ Hesap hazır\n");
  console.log("─".repeat(60));
  console.log("Şirket :", result.company.name);
  console.log("Şirket ID:", result.company.id);
  console.log("Ad Soyad:", result.user.fullName);
  console.log("E-posta :", result.user.email);
  console.log("Şifre   :", password);
  console.log("Rol     : admin");
  console.log("─".repeat(60));
  console.log("Login   : http://localhost:3001/login");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
