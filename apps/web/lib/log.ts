/**
 * Lightweight server-side logger.
 *
 * - In dev, writes to `console.*` with prefix.
 * - In production, emits structured JSON so an aggregator (Vercel logs, Sentry,
 *   Loki, etc.) can parse it. Hook in Sentry or pino transports here later.
 * - PII filter: keys matching SENSITIVE_KEYS are redacted before serialization.
 */

type Level = "info" | "warn" | "error";
type Ctx = Record<string, unknown>;

const isProd = process.env.NODE_ENV === "production";
const SENSITIVE_KEYS = /^(password|token|secret|authorization|cookie|api[_-]?key)$/i;

function redact(ctx?: Ctx): Ctx | undefined {
  if (!ctx) return undefined;
  const out: Ctx = {};
  for (const [k, v] of Object.entries(ctx)) {
    out[k] = SENSITIVE_KEYS.test(k) ? "[REDACTED]" : v;
  }
  return out;
}

function emit(level: Level, msg: string, ctx?: Ctx, err?: unknown) {
  const payload = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...(ctx ? { ctx: redact(ctx) } : {}),
    ...(err
      ? {
          error: {
            message: err instanceof Error ? err.message : String(err),
            name: err instanceof Error ? err.name : undefined,
            stack: err instanceof Error && !isProd ? err.stack : undefined,
          },
        }
      : {}),
  };

  if (isProd) {
    // Structured JSON for log aggregators.
    const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    writer(JSON.stringify(payload));
  } else {
    const prefix = `[${level.toUpperCase()}]`;
    if (level === "error") console.error(prefix, msg, payload);
    else if (level === "warn") console.warn(prefix, msg, payload);
    else console.log(prefix, msg, payload);
  }
}

export const log = {
  info: (msg: string, ctx?: Ctx) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: Ctx) => emit("warn", msg, ctx),
  error: (err: unknown, ctx?: Ctx) => {
    const msg = err instanceof Error ? err.message : "Unknown error";
    emit("error", msg, ctx, err);
  },
};
