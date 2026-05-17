# ============================================
# StokTakip Pro — Multi-stage Docker Build
# Optimized for Coolify deployment
# ============================================

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter web...

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

WORKDIR /app/apps/web
RUN pnpm build

# --- Runner ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Health check for Coolify
# Use 127.0.0.1 explicitly — wget on alpine resolves "localhost" to ::1 first
# but Next.js standalone listens on 0.0.0.0 (IPv4 only), so IPv6 probe fails.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
