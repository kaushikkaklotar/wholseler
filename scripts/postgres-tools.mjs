import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
config({ path: path.join(root, ".env"), quiet: true });
export function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`Missing value for ${name}`);
  return value;
}
export function databaseUrl() {
  let url;
  try {
    url = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error("Configure DATABASE_URL before using database tools");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname.slice(1)
  )
    throw new Error("DATABASE_URL must identify a PostgreSQL database");
  return url;
}
export function client(url) {
  return new PrismaClient({ datasources: { db: { url: url.toString() } } });
}
export function connectionEnv(url) {
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGCONNECT_TIMEOUT: "10",
    PGCLIENTENCODING: "UTF8",
  };
  for (const [key, variable] of [
    ["sslmode", "PGSSLMODE"],
    ["sslrootcert", "PGSSLROOTCERT"],
    ["sslcert", "PGSSLROOTCERT"],
    ["sslkey", "PGSSLKEY"],
  ])
    if (url.searchParams.has(key)) env[variable] = url.searchParams.get(key);
  if (url.searchParams.get("sslaccept") === "strict")
    env.PGSSLMODE = "verify-full";
  if (url.searchParams.has("sslidentity"))
    throw new Error(
      "For PKCS12 client-certificate databases, configure libpq PGSSLCERT / PGSSLKEY and use a backup connection without sslidentity",
    );
  return env;
}
export async function pgTool(name, args, url) {
  const bin = option("--pg-bin") || process.env.PG_BIN;
  const executable = bin
    ? path.join(bin, `${name}${process.platform === "win32" ? ".exe" : ""}`)
    : name;
  try {
    return await promisify(execFile)(executable, ["--no-password", ...args], {
      env: connectionEnv(url),
      timeout: 30 * 60 * 1000,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    throw new Error(
      `${name} failed. Check matching PostgreSQL client version, privileges, TLS and connectivity. Credentials were not logged.`,
    );
  }
}
export async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
export async function tableCounts(db) {
  const tables =
    await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  const counts = Object.create(null);
  for (const { tablename } of tables) {
    const [row] = await db.$queryRawUnsafe(
      `SELECT count(*)::text AS count FROM "public"."${tablename.replaceAll('"', '""')}"`,
    );
    counts[tablename] = row.count;
  }
  return counts;
}
