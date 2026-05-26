#!/bin/sh
set -e

# Apply pending Prisma migrations.
# Safe to re-run — migrate deploy only applies migrations that haven't run yet.
echo "→ Running prisma migrate deploy..."
cd /app/apps/web
node node_modules/prisma/build/index.js migrate deploy
echo "✓ Migrations applied"

# Start Next.js standalone server.
cd /app
exec node apps/web/server.js
