import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "dotenv";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env"), quiet: true });
if (process.platform === "win32" && !process.env.ComSpec)
  process.env.ComSpec = "C:\\Windows\\System32\\cmd.exe";
process.env.WHOLESALE_ROOT = root;
const production = process.argv.includes("--production");
if (production) process.env.NODE_ENV = "production";
const children = [];
let closing = false;
function run(label, script, args, cwd = root) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  children.push(child);
  child.on("exit", (code) => {
    if (!closing) {
      console.error(`${label} exited (${code}).`);
      stop(code ?? 1);
    }
  });
  return child;
}
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 1000).unref();
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
if (!production) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(root, "node_modules/typescript/bin/tsc"),
        "-p",
        "packages/shared/tsconfig.json",
      ],
      { cwd: root, env: process.env, stdio: "inherit" },
    );
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Shared package compilation failed")),
    );
  });
}
const api = path.join(root, "apps/api");
process.env.TSX_TSCONFIG_PATH = path.join(api, "tsconfig.json");
const apiChild = spawn(
  process.execPath,
  production
    ? [path.join(api, "dist/main.js")]
    : ["--watch", "--import", "tsx", path.join(api, "src/main.ts")],
  { cwd: root, env: process.env, stdio: "inherit" },
);
children.push(apiChild);
apiChild.on("exit", (code) => {
  if (!closing) {
    console.error(`API exited (${code}).`);
    stop(code ?? 1);
  }
});

run(
  "Web",
  path.join(root, "node_modules/next/dist/bin/next"),
  [
    production ? "start" : "dev",
    "--hostname",
    production ? process.env.WEB_HOST || "127.0.0.1" : "127.0.0.1",
    "--port",
    process.env.WEB_PORT || "3000",
  ],
  path.join(root, "apps/web"),
);
console.log(`Wholseler: http://127.0.0.1:${process.env.WEB_PORT || 3000}`);
