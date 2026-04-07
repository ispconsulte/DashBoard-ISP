import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DEV_PORT = 8080;
const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

const parsePort = (value) => {
  if (!value) return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const args = process.argv.slice(2);
let explicitPort;
const passthroughArgs = [];

for (let index = 0; index < args.length; index += 1) {
  const current = args[index];

  if (current === "--port") {
    explicitPort = parsePort(args[index + 1]);
    index += 1;
    continue;
  }

  if (current.startsWith("--port=")) {
    explicitPort = parsePort(current.slice("--port=".length));
    continue;
  }

  // Some preview runners append the port as a bare positional argument.
  if (/^\d+$/.test(current)) {
    explicitPort ??= parsePort(current);
    continue;
  }

  passthroughArgs.push(current);
}

const serverPort =
  explicitPort ??
  parsePort(process.env.PORT) ??
  parsePort(process.env.npm_config_port) ??
  parsePort(process.env.VITE_PORT) ??
  DEFAULT_DEV_PORT;

const vitePackageJson = require.resolve("vite/package.json");
const viteBin = path.join(path.dirname(vitePackageJson), "bin", "vite.js");
const child = spawn(
  process.execPath,
  [
    viteBin,
    "--host",
    "0.0.0.0",
    "--port",
    String(serverPort),
    "--config",
    path.join(projectRoot, "vite.config.ts"),
    ...passthroughArgs,
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(serverPort),
    },
    stdio: "inherit",
  }
);

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
