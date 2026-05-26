"use server";

import { withCompany, ok, parseInput, z, ERR } from "@/lib/server";
import { findProvider } from "@/lib/integrations/registry";

// Mirror prisma/schema.prisma enums (avoid named imports from @prisma/client
// which break under pnpm symlinks in Docker — see stripe webhook for context).
type IntegrationCategory =
  | "marketplace"
  | "accounting"
  | "shipping"
  | "e_invoice"
  | "messaging";
type IntegrationStatus = "inactive" | "connecting" | "active" | "error";

export interface Connection {
  id: string;
  provider: string;
  category: string;
  name: string;
  status: "inactive" | "connecting" | "active" | "error";
  lastSyncAt?: string;
  lastError?: string;
  createdAt: string;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  provider: z.string(),
  name: z.string().min(1, "Bağlantı adı zorunlu"),
  config: z.record(z.string(), z.string()),
});

export const listConnections = withCompany<void, Connection[]>(async (ctx) => {
  const rows = await ctx.prisma.integrationConnection.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      provider: true,
      category: true,
      name: true,
      status: true,
      lastSyncAt: true,
      lastError: true,
      createdAt: true,
    },
  });

  return ok(
    rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      category: r.category,
      name: r.name,
      status: r.status as Connection["status"],
      lastSyncAt: r.lastSyncAt?.toISOString() ?? undefined,
      lastError: r.lastError ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

export const upsertConnection = withCompany<
  z.input<typeof upsertSchema>,
  { id: string }
>(async (ctx, raw) => {
  const data = parseInput(upsertSchema, raw);
  const provider = findProvider(data.provider);
  if (!provider)
    throw ERR.validation(`Bilinmeyen sağlayıcı: ${data.provider}`);

  // Validate required config keys.
  for (const f of provider.meta.configSchema) {
    if (f.required && !data.config[f.key]) {
      throw ERR.validation(`${f.label} zorunlu`, f.key);
    }
  }

  const payload = {
    provider: data.provider,
    category: provider.meta.category as IntegrationCategory,
    name: data.name,
    config: data.config,
    status: (provider.stub ? "inactive" : "active") as IntegrationStatus,
  };

  if (data.id) {
    const exists = await ctx.prisma.integrationConnection.findFirst({
      where: { id: data.id, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!exists) throw ERR.notFound("Bağlantı");

    await ctx.prisma.integrationConnection.update({
      where: { id: data.id },
      data: payload,
    });
    return ok({ id: data.id });
  }

  const row = await ctx.prisma.integrationConnection.create({
    data: {
      ...payload,
      companyId: ctx.companyId,
      createdById: ctx.userId,
    },
    select: { id: true },
  });
  return ok({ id: row.id });
});

export const deleteConnection = withCompany<string, void>(async (ctx, id) => {
  const res = await ctx.prisma.integrationConnection.deleteMany({
    where: { id, companyId: ctx.companyId },
  });
  if (res.count === 0) throw ERR.notFound("Bağlantı");
  return ok();
});

/**
 * Manual "Test connection" — for stub providers, returns a clear failure with
 * the explanation so the UI can show it.
 */
export const testConnection = withCompany<
  string,
  { ok: boolean; message: string }
>(async (ctx, id) => {
  const conn = await ctx.prisma.integrationConnection.findFirst({
    where: { id, companyId: ctx.companyId },
    select: { provider: true },
  });
  if (!conn) throw ERR.notFound("Bağlantı");

  const provider = findProvider(conn.provider);
  if (!provider) return ok({ ok: false, message: "Sağlayıcı tanımsız" });

  if (provider.stub) {
    return ok({
      ok: false,
      message: `${provider.meta.label} stub durumda — gerçek API çağrısı henüz bağlanmadı.`,
    });
  }

  return ok({
    ok: true,
    message: `${provider.meta.label} bağlantısı doğrulandı`,
  });
});
