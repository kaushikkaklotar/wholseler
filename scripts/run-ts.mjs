import { spawn } from "node:child_process";
import path from "node:path";
import { readdir } from "node:fs/promises";
const args = process.argv.slice(2);
const runtimeArgs =
  args[0] === "--test"
    ? [
        "--test",
        ...(await readdir("tests"))
          .filter((f) => f.endsWith(".test.ts"))
          .map((f) => path.resolve("tests", f)),
      ]
    : args;
const child = spawn(process.execPath, ["--import", "tsx", ...runtimeArgs], {
  stdio: "inherit",
  env: {
    ...process.env,
    TSX_TSCONFIG_PATH: path.resolve("apps/api/tsconfig.json"),
  },
});
child.on("exit", (code) => process.exit(code ?? 1));
