import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const mode = args.includes("start") ? "start" : "dev";
const httpsRequested = args.includes("--https") || process.env.HTTPS === "1";
const useHttps = mode === "dev" && httpsRequested;
const host = "0.0.0.0";
const webDir = resolve("apps", "web");
const nextCli = resolve(webDir, "node_modules", "next", "dist", "bin", "next");
const certDir = resolve(webDir, "certificates");
const certPath = resolve(certDir, "dev-server.cert.pem");
const keyPath = resolve(certDir, "dev-server.key.pem");
const preferredPort = Number.parseInt(process.env.PORT || "3000", 10);

if (!Number.isInteger(preferredPort) || preferredPort < 1 || preferredPort > 65535) {
  console.error("PORT must be a number between 1 and 65535.");
  process.exit(1);
}

function getLanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter(Boolean)
    .filter((net) => net.family === "IPv4" && !net.internal)
    .map((net) => net.address);
}

function isPortAvailable(port) {
  return new Promise((resolveAvailability) => {
    const server = createServer()
      .once("error", () => resolveAvailability(false))
      .once("listening", () => {
        server.close(() => resolveAvailability(true));
      })
      .listen(port, host);
  });
}

async function getPort() {
  if (process.env.PORT) {
    return preferredPort;
  }

  for (let candidate = preferredPort; candidate < preferredPort + 50; candidate += 1) {
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }

  console.error(`No available port found between ${preferredPort} and ${preferredPort + 49}.`);
  process.exit(1);
}

const port = String(await getPort());
const lanAddresses = getLanAddresses();
const protocol = useHttps ? "https" : "http";
const primaryUrl = lanAddresses.length
  ? `${protocol}://${lanAddresses[0]}:${port}`
  : `${protocol}://<bilgisayar-ip-adresi>:${port}`;

const nextMode = mode === "start" ? "start" : "dev";

function ensureHttpsCertificate(hosts) {
  const certScript = resolve("scripts", "create-local-cert.ps1");
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      certScript,
      "-OutputDir",
      certDir,
      "-Hosts",
      hosts.join(","),
    ],
    {
      cwd: resolve("."),
      stdio: "inherit",
    }
  );

  if (result.error) {
    console.error(`Local HTTPS certificate could not be created: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error("Local HTTPS certificate could not be created.");
    process.exit(result.status ?? 1);
  }
}

if (useHttps) {
  ensureHttpsCertificate(["localhost", "127.0.0.1", "::1", ...lanAddresses]);
}

const nextArgs = [
  nextCli,
  nextMode,
  "--hostname",
  host,
  "--port",
  port,
];

if (nextMode === "dev") {
  nextArgs.splice(2, 0, "--webpack");
  if (useHttps) {
    nextArgs.splice(
      3,
      0,
      "--experimental-https",
      "--experimental-https-key",
      keyPath,
      "--experimental-https-cert",
      certPath
    );
  }
}

console.log("");
console.log(`StokTakip ${mode === "start" ? "production" : "development"} LAN server${useHttps ? " (HTTPS)" : ""}`);
console.log(`Local:   ${protocol}://localhost:${port}`);
console.log(`Network: ${primaryUrl}`);
if (lanAddresses.length > 1) {
  console.log(`Other:   ${lanAddresses.slice(1).map((ip) => `${protocol}://${ip}:${port}`).join(", ")}`);
}
console.log("");
if (httpsRequested && !useHttps) {
  console.log("HTTPS mode is only available with Next.js dev server. Production start is using HTTP.");
  console.log("");
}
if (useHttps) {
  console.log("Telefon kamerası için HTTPS adresini açın. Tarayıcı sertifika uyarısı gösterirse bir kez kabul etmeniz gerekir.");
  console.log("");
}
console.log("Telefon aynı Wi-Fi ağında olmalı. Açılmazsa Windows Güvenlik Duvarı'nda Node.js için Private network izni verin.");
console.log("");

const child = spawn(process.execPath, nextArgs, {
  cwd: webDir,
  env: {
    ...process.env,
    HOSTNAME: host,
    PORT: port,
    NEXT_PUBLIC_APP_URL: primaryUrl,
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Next.js server could not be started: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
