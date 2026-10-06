import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env"), quiet: true });
if (process.env.NODE_ENV === "production")
  throw new Error("This helper is for local development only");
const url = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("Only loopback databases are supported");
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
let target;
try {
  const [{ encoding }] = await db.$queryRawUnsafe(
    "SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname=current_database()",
  );
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "");
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-zA-Z0-9_]+$/.test(name))
    throw new Error("Unsupported database name");
  const targetName = `${name.slice(0, 30)}_utf8_${stamp}`;
  const binIndex = process.argv.indexOf("--pg-bin");
  const bin =
    binIndex >= 0
      ? process.argv[binIndex + 1]
      : process.platform === "win32"
        ? "C:/Program Files/PostgreSQL/18/bin"
        : "/usr/bin";
  const executable = (tool) =>
    path.join(bin, `${tool}${process.platform === "win32" ? ".exe" : ""}`);
  if (
    !existsSync(executable("pg_dump")) ||
    !existsSync(executable("pg_restore"))
  )
    throw new Error("Provide PostgreSQL 18 tools with --pg-bin");
  const backupDir = path.join(root, ".data/backups");
  mkdirSync(backupDir, { recursive: true });
  const dump = path.join(backupDir, `${name}-${stamp}.dump`);
  const envText = readFileSync(path.join(root, ".env"), "utf8");
  writeFileSync(path.join(backupDir, `${name}-${stamp}.env`), envText, {
    mode: 0o600,
  });
  const args = [
    "--host",
    url.hostname,
    "--port",
    url.port || "5432",
    "--username",
    decodeURIComponent(url.username),
  ];
  const run = (tool, extra) => {
    const result = spawnSync(executable(tool), [...args, ...extra], {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
    });
    if (result.error || result.status !== 0)
      throw new Error(
        `${tool} failed. Original database and configuration have been preserved.`,
      );
  };
  run("pg_dump", [
    "--dbname",
    name,
    "--format=custom",
    "--encoding=UTF8",
    "--file",
    dump,
  ]);
  console.log(`Database backup saved: ${path.basename(dump)}`);
  if (encoding === "UTF8") {
    console.log("Database already uses UTF8; no configuration change needed");
  } else {
    // New database only: the original is retained for rollback, never dropped.
    await db.$executeRawUnsafe(
      `CREATE DATABASE "${targetName}" WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    run("pg_restore", [
      "--dbname",
      targetName,
      "--no-owner",
      "--no-acl",
      "--exit-on-error",
      dump,
    ]);
    const newUrl = new URL(url);
    newUrl.pathname = `/${targetName}`;
    target = new PrismaClient({
      datasources: { db: { url: newUrl.toString() } },
    });
    const tables = await db.$queryRawUnsafe(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    );
    for (const { tablename } of tables) {
      const sql = `SELECT count(*)::int AS count FROM "public"."${tablename.replaceAll('"', '""')}"`;
      const [before, after] = await Promise.all([
        db.$queryRawUnsafe(sql),
        target.$queryRawUnsafe(sql),
      ]);
      if (before[0].count !== after[0].count)
        throw new Error(
          "Restore verification failed; original configuration retained",
        );
    }
    const changed = envText.replace(
      /^DATABASE_URL=.*$/m,
      `DATABASE_URL=${JSON.stringify(newUrl.toString())}`,
    );
    if (changed === envText)
      throw new Error("DATABASE_URL must be present in .env");
    writeFileSync(path.join(root, ".env"), changed, { mode: 0o600 });
    console.log(
      `UTF8 restore verified across ${tables.length} tables; original database retained. Restart the app.`,
    );
  }
} finally {
  await target?.$disconnect();
  await db.$disconnect();
}
