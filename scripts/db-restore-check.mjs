import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  option,
  databaseUrl,
  client,
  pgTool,
  sha256,
  tableCounts,
} from "./postgres-tools.mjs";

async function main() {
  const archive = option("--archive"),
    name = option("--target-name");
  if (!archive || !name || !/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(name))
    throw new Error(
      "Usage: npm run db:restore-check -- --archive <backup.dump> --target-name <NEW_database_name> [--pg-bin <directory>]",
    );
  const file = path.resolve(archive),
    manifest = JSON.parse(await readFile(`${file}.json`, "utf8"));
  if (
    manifest.version !== 1 ||
    manifest.archive !== path.basename(file) ||
    !manifest.tables ||
    typeof manifest.tables !== "object" ||
    Array.isArray(manifest.tables) ||
    !Object.values(manifest.tables).every(
      (n) => typeof n === "string" && /^\d+$/.test(n),
    ) ||
    manifest.sha256 !== (await sha256(file))
  )
    throw new Error(
      "Backup manifest or checksum is invalid; no database was created",
    );
  const url = databaseUrl();
  if (decodeURIComponent(url.pathname.slice(1)) === name)
    throw new Error(
      "Target must be a NEW database; the application database is never replaced",
    );
  await pgTool("pg_restore", ["--list", file], url);
  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = "/postgres";
  const maintenance = client(maintenanceUrl);
  let target;
  try {
    const exists =
      await maintenance.$queryRaw`SELECT 1 FROM pg_database WHERE datname=${name}`;
    if (exists.length)
      throw new Error(
        "Target database already exists; nothing was overwritten",
      );
    await maintenance.$executeRawUnsafe(
      `CREATE DATABASE "${name}" WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    const targetUrl = new URL(url);
    targetUrl.pathname = `/${name}`;
    await pgTool(
      "pg_restore",
      [
        "--dbname",
        name,
        "--no-owner",
        "--no-acl",
        "--exit-on-error",
        "--single-transaction",
        file,
      ],
      url,
    );
    target = client(targetUrl);
    const counts = await tableCounts(target);
    // JSON key order can differ when the source and recovery database use
    // different collations, or an operator reformats the sidecar.
    const keys = Object.keys(counts);
    if (
      keys.length !== Object.keys(manifest.tables).length ||
      keys.some((key) => counts[key] !== manifest.tables[key])
    )
      throw new Error(
        "Restore counts differ from the backup snapshot; target retained for inspection. Application configuration was not changed.",
      );
    console.log(
      `Restore verified: ${name}; ${Object.keys(counts).length} public tables match the backup snapshot.`,
    );
    console.log(
      "Application database and .env were not changed. The verified target is retained; switch connections only during an explicitly planned recovery.",
    );
  } finally {
    await target?.$disconnect();
    await maintenance.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error && error.name === "Error"
      ? error.message
      : "Restore check failed; application database and configuration remain unchanged. Inspect the new target database before retrying.",
  );
  process.exitCode = 1;
});
