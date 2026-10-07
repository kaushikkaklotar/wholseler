import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { importSupplierListings } from "../apps/api/src/supplier-directory";
const db = new PrismaClient();
async function main() {
try {
  const count = await importSupplierListings(db, JSON.parse(await readFile(path.resolve("packages/db/data/surat-suppliers.json"), "utf8")));
  console.log(`Imported ${count} source-backed Surat supplier listings. No user accounts, inventory or billing records changed.`);
} finally {
  await db.$disconnect();
}
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Supplier import failed"); process.exitCode = 1; });
