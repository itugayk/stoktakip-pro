# ============================================
# StokTakip Pro — Multi-stage Docker Build
# Optimized for Coolify deployment
# Stack: Next.js 16 (standalone) + Prisma 6 + NextAuth v5
# ============================================

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
# Pin pnpm to the same major used to generate pnpm-lock.yaml (avoids
# frozen-lockfile compatibility drift between local + CI builds).
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

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

# IMPORTANT: don't set NODE_ENV=production in the builder stage.
# pnpm/npm skip devDependencies in production mode, which breaks
# `next build` (it needs typescript, eslint-config-next, @types/*).
# Production NODE_ENV is set only in the runner stage below.
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma client must be generated BEFORE Next.js build,
# otherwise Server Actions that import @prisma/client fail to compile.
WORKDIR /app/apps/web
RUN pnpm exec prisma generate

# Next.js build (outputs to apps/web/.next/standalone)
RUN pnpm build

# --- Runner ---
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js standalone output (includes minimal node_modules)
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Prisma assets — schema + raw SQL + generated client.
# Default prisma generate (no `output` in schema) writes to the pnpm-hoisted
# `.pnpm/@prisma+client.../node_modules/.prisma/client`; the symlink in
# `apps/web/node_modules/@prisma/client` resolves there. So copy the .pnpm
# tree (covers prisma engines + generated client) and the apps/web prisma
# folder (schema + raw SQL needed by `prisma migrate deploy` at startup).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/node_modules ./apps/web/node_modules

# Entrypoint: apply migrations at startup, then start the Next.js server.
COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# Health check for Coolify
# Use 127.0.0.1 explicitly — wget on alpine resolves "localhost" to ::1 first
# but Next.js standalone listens on 0.0.0.0 (IPv4 only), so IPv6 probe fails.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
