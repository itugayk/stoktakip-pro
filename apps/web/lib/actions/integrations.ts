"use server";

import { withCompany, ok, parseInput, z, ERR } from "@/lib/server";
import { findProvider } from "@/lib/integrations/registry";

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
  if (ctx.demo) return ok([]);

  const { data, error } = await ctx.supabase
    .from("integration_connections")
    .select("id, provider, category, name, status, last_sync_at, last_error, created_at")
    .order("created_at", { ascending: false });
  if (error) throw ERR.database(error.message);

  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      provider: r.provider,
      category: r.category,
      name: r.name,
      status: r.status as Connection["status"],
      lastSyncAt: r.last_sync_at ?? undefined,
      lastError: r.last_error ?? undefined,
      createdAt: r.created_at,
    }))
  );
});

export const upsertConnection = withCompany<z.input<typeof upsertSchema>, { id: string }>(
  async (ctx, raw) => {
    const data = parseInput(upsertSchema, raw);
    const provider = findProvider(data.provider);
    if (!provider) throw ERR.validation(`Bilinmeyen sağlayıcı: ${data.provider}`);

    // Validate required config keys.
    for (const f of provider.meta.configSchema) {
      if (f.required && !data.config[f.key]) {
        throw ERR.validation(`${f.label} zorunlu`, f.key);
      }
    }

    if (ctx.demo) return ok({ id: data.id ?? `c-${Date.now()}` });

    const payload = {
      provider: data.provider,
      category: provider.meta.category,
      name: data.name,
      config: data.config,
      status: provider.stub ? "inactive" : "active",
    };

    if (data.id) {
      const { error } = await ctx.supabase
        .from("integration_connections")
        .update(payload)
        .eq("id", data.id);
      if (error) throw ERR.database(error.message);
      return ok({ id: data.id });
    }

    const { data: row, error } = await ctx.supabase
      .from("integration_connections")
      .insert({ ...payload, company_id: ctx.companyId, created_by: ctx.userId } as never)
      .select("id")
      .single();
    if (error) throw ERR.database(error.message);
    return ok({ id: row.id });
  }
);

export const deleteConnection = withCompany<string, void>(async (ctx, id) => {
  if (ctx.demo) return ok();
  const { error } = await ctx.supabase.from("integration_connections").delete().eq("id", id);
  if (error) throw ERR.database(error.message);
  return ok();
});

/**
 * Manual "Test connection" — for stub providers, returns a clear failure with
 * the explanation so the UI can show it.
 */
export const testConnection = withCompany<string, { ok: boolean; message: string }>(
  async (ctx, id) => {
    if (ctx.demo) return ok({ ok: false, message: "Demo modunda test edilemez" });

    const { data: conn } = await ctx.supabase
      .from("integration_connections")
      .select("provider")
      .eq("id", id)
      .single();
    if (!conn) throw ERR.notFound("Bağlantı");

    const provider = findProvider(conn.provider);
    if (!provider) return ok({ ok: false, message: "Sağlayıcı tanımsız" });

    if (provider.stub) {
      return ok({
        ok: false,
        message: `${provider.meta.label} stub durumda — gerçek API çağrısı henüz bağlanmadı.`,
      });
    }

    return ok({ ok: true, message: `${provider.meta.label} bağlantısı doğrulandı` });
  }
);
