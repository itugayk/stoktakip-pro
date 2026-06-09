import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");
const appDir = dirname(fileURLToPath(import.meta.url));

function getAllowedDevOrigins() {
  const lanAddresses: string[] = [];

  for (const nets of Object.values(networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        lanAddresses.push(net.address);
      }
    }
  }

  return ["localhost", "127.0.0.1", ...lanAddresses];
}

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: resolve(appDir, "../.."),
  allowedDevOrigins: getAllowedDevOrigins(),
  // The production image is built on a memory-constrained Coolify box where the
  // post-compile `tsc`/ESLint pass OOM-kills `next build` (the webpack compile
  // itself succeeds). We already run `tsc --noEmit` + ESLint locally before
  // pushing, so type/lint errors are caught there — skip the redundant in-build
  // pass to keep the deploy build within memory. Re-enable if a CI typecheck is
  // ever removed.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
