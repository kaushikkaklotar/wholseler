import { PrismaClient } from "@prisma/client";
import path from "node:path";
import {
  productionConfigChecks,
  productionDataChecks,
  type LaunchCheck,
} from "../apps/api/src/production";

async function main() {
  const checks = productionConfigChecks(process.env);
  if (!process.argv.includes("--offline")) {
    const db = new PrismaClient();
    try {
      checks.push(...(await productionDataChecks(db, path.resolve("."))));
    } catch {
      checks.push({
        id: "database-access",
        status: "FAIL",
        message:
          "Database or migrated schema unavailable; inspect connectivity and run db:deploy",
      });
    } finally {
      await db.$disconnect();
    }
  } else
    checks.push({
      id: "database-checks",
      status: "WARN",
      message: "Database checks skipped (--offline)",
    });
  for (const c of checks)
    console.log(`${c.status.padEnd(4)} ${c.id}: ${c.message}`);
  const failures = checks.filter(
    (c: LaunchCheck) => c.status === "FAIL",
  ).length;
  console.log(
    `Launch assessment: ${failures ? `BLOCKED (${failures} failures)` : "configuration and database checks passed; follow the live acceptance checklist"}`,
  );
  process.exitCode = failures ? 1 : 0;
}
main().catch(() => {
  console.error(
    "Launch assessment failed; inspect configuration and database connectivity",
  );
  process.exitCode = 1;
});
