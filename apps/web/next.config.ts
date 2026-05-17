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
