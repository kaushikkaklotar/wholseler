import { mkdir, chmod, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  root,
  option,
  databaseUrl,
  client,
  pgTool,
  sha256,
  tableCounts,
} from "./postgres-tools.mjs";

async function main() {
  const url = databaseUrl(),
    db = client(url);
  const dir = path.resolve(
    option("--out-dir") || path.join(root, ".data/backups"),
  );
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const name = `wholseler-${new Date().toISOString().replace(/[^0-9]/g, "")}-${randomUUID().slice(0, 8)}.dump`;
  const file = path.join(dir, name),
    partial = `${file}.incomplete`;
  try {
    // pg_dump and counts use the same exported MVCC snapshot, even with live writes.
    const counts = await db.$transaction(
      async (tx) => {
        const [{ snapshot }] =
          await tx.$queryRaw`SELECT pg_export_snapshot() AS snapshot`;
        const counts = await tableCounts(tx);
        await pgTool(
          "pg_dump",
          [
            "--format=custom",
            "--encoding=UTF8",
            "--no-owner",
            "--no-acl",
            "--snapshot",
            snapshot,
            "--file",
            partial,
          ],
          url,
        );
        return counts;
      },
      { isolationLevel: "RepeatableRead", timeout: 30 * 60 * 1000 },
    );
    await chmod(partial, 0o600);
    await pgTool("pg_restore", ["--list", partial], url);
    const digest = await sha256(partial);
    // Sidecar and archive are uniquely named; no existing backup is replaced.
    await writeFile(
      `${file}.json`,
      JSON.stringify(
        {
          version: 1,
          createdAt: new Date().toISOString(),
          archive: name,
          sha256: digest,
          tables: counts,
        },
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
    await rename(partial, file);
    console.log(`Backup complete: ${file}`);
    console.log(
      `Snapshot counts recorded for ${Object.keys(counts).length} public tables. Keep the .dump and .dump.json together; copy both to encrypted off-host storage.`,
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error && error.name === "Error"
      ? error.message
      : "Backup failed. No database or previous backup was modified.",
  );
  process.exitCode = 1;
});
