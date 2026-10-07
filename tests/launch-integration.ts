import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { productionDataChecks } from "../apps/api/src/production";
import { AuthService } from "../apps/api/src/auth";
import { Database } from "../apps/api/src/database";
import type { SessionUser } from "@wholesale/shared";

async function main() {
  const root = path.resolve("."),
    tag = randomUUID().replaceAll("-", "");
  const name = `launch_test_${tag}`,
    restored = `launch_restore_${tag}`,
    corruptTarget = `launch_corrupt_${tag}`;
  const original = new URL(process.env.DATABASE_URL!);
  const maintenanceUrl = new URL(original);
  maintenanceUrl.pathname = "/postgres";
  const url = new URL(original);
  url.pathname = `/${name}`;
  const maintenance = new PrismaClient({
    datasources: { db: { url: maintenanceUrl.toString() } },
  });
  const db = new Database({ datasources: { db: { url: url.toString() } } });
  const env = {
    ...process.env,
    DATABASE_URL: url.toString(),
    NODE_ENV: "test",
    AUTH_MODE: "development",
    SEED_SAMPLE_DATA: "false",
    TSX_TSCONFIG_PATH: path.join(root, "apps/api/tsconfig.json"),
  };
  const run = async (args: string[], expected = 0) => {
    try {
      const output = await promisify(execFile)(process.execPath, args, {
        cwd: root,
        env,
        timeout: 120000,
        maxBuffer: 2 * 1024 * 1024,
      });
      assert.equal(expected, 0, "Command unexpectedly succeeded");
      return output.stdout;
    } catch (error) {
      if (expected === 0)
        throw new Error(
          `Launch command failed (${args[0]}); credentials suppressed`,
          { cause: undefined },
        );
      assert.equal((error as { code: unknown }).code, expected);
      return (error as { stderr: string }).stderr;
    }
  };
  const bootstrap = (phone = "9876543210") => [
    "scripts/run-ts.mjs",
    "scripts/bootstrap-production.ts",
    "--phone",
    phone,
    "--name",
    "Launch Test Admin",
  ];
  let target: PrismaClient | undefined;
  let created = false;
  try {
    await maintenance.$executeRawUnsafe(
      `CREATE DATABASE "${name}" WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
    );
    created = true;
    await run([
      "node_modules/prisma/build/index.js",
      "migrate",
      "deploy",
      "--schema",
      "packages/db/schema.prisma",
    ]);
    const empty = await productionDataChecks(db, root);
    assert.ok(empty.some((c) => c.id === "plans" && c.status === "FAIL"));
    assert.ok(
      empty.some((c) => c.id === "administrator" && c.status === "FAIL"),
    );
    await run(bootstrap());
    assert.equal(await db.plan.count(), 3);
    assert.equal(await db.user.count(), 1);
    await db.plan.update({
      where: { id: "plan-starter" },
      data: { monthlyPricePaise: 12345 },
    });
    await run(bootstrap());
    assert.equal(await db.user.count(), 1);
    assert.equal(
      (await db.plan.findUniqueOrThrow({ where: { id: "plan-starter" } }))
        .monthlyPricePaise,
      12345,
    );
    assert.ok(
      (await productionDataChecks(db, root)).every((c) => c.status === "PASS"),
    );
    const owner = await db.user.create({
      data: {
        phone: "9876543211",
        name: "Test owner",
        role: "WHOLESALER_OWNER",
      },
    });
    await run(bootstrap(owner.phone), 1);
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: owner.id } })).role,
      "WHOLESALER_OWNER",
    );
    const sample = await db.user.create({
      data: {
        phone: "9876543212",
        name: "Demo",
        role: "SELLER",
        isSample: true,
      },
    });
    assert.ok(
      (await productionDataChecks(db, root)).some(
        (c) => c.id === "demo-data" && c.status === "FAIL",
      ),
    );
    await db.user.delete({ where: { id: sample.id } });
    const auth = new AuthService(db);
    await auth.onboard(
      { ...owner, onboardingRequired: true } as unknown as SessionUser,
      {
        ownerName: "આકાશ",
        name: "નમસ્તે / नमस्ते Wholesale",
        phone: owner.phone,
        address: "Test textile market",
        city: "Surat",
        marketArea: "Ring Road",
        categories: ["Sarees"],
      },
    );
    const business = await db.business.findUniqueOrThrow({
      where: { ownerId: owner.id },
    });
    assert.equal(business.planId, "plan-starter");
    const product = await db.product.create({
      data: {
        businessId: business.id,
        name: "ગુજરાતી સાડી / हिंदी",
        sku: "RESTORE-TEST",
        category: "Sarees",
        tags: [],
        pricePaise: 75000,
        variants: {
          create: {
            businessId: business.id,
            size: "Free",
            color: "લાલ",
            stock: 20,
            reserved: 4,
          },
        },
      },
      include: { variants: true },
    });
    const dir = path.join(root, ".data/launch-tests", tag);
    await mkdir(dir, { recursive: true });
    const bin = process.env.PG_BIN ? ["--pg-bin", process.env.PG_BIN] : [];
    await run(["scripts/db-backup.mjs", "--out-dir", dir, ...bin]);
    const file = path.join(
      dir,
      (await readdir(dir)).find((n) => n.endsWith(".dump"))!,
    );
    assert.ok(file.endsWith(".dump"));
    const sidecar = JSON.parse(await readFile(`${file}.json`, "utf8"));
    // Valid JSON formatting / source collation must not change count validation.
    sidecar.tables = Object.fromEntries(
      Object.entries(sidecar.tables).reverse(),
    );
    await writeFile(`${file}.json`, JSON.stringify(sidecar));
    // Source writes after the backup must not affect restored snapshot values.
    await db.variant.update({
      where: { id: product.variants[0].id },
      data: { stock: 23 },
    });
    const restoreArgs = [
      "scripts/db-restore-check.mjs",
      "--archive",
      file,
      "--target-name",
      restored,
      ...bin,
    ];
    await run(restoreArgs);
    const targetUrl = new URL(url);
    targetUrl.pathname = `/${restored}`;
    target = new PrismaClient({
      datasources: { db: { url: targetUrl.toString() } },
    });
    const restoredProduct = await target.product.findUniqueOrThrow({
      where: { id: product.id },
      include: { variants: true },
    });
    assert.equal(restoredProduct.name, product.name);
    assert.equal(restoredProduct.variants[0].stock, 20);
    assert.equal(restoredProduct.variants[0].reserved, 4);
    assert.equal(restoredProduct.variants[0].color, "લાલ");
    await run(restoreArgs, 1); // Existing target is preserved.
    const corrupt = path.join(dir, "corrupt.dump");
    const manifest = JSON.parse(await readFile(`${file}.json`, "utf8"));
    await writeFile(corrupt, Buffer.from("invalid backup"));
    await writeFile(
      `${corrupt}.json`,
      JSON.stringify({ ...manifest, archive: "corrupt.dump" }),
    );
    await run(
      [
        "scripts/db-restore-check.mjs",
        "--archive",
        corrupt,
        "--target-name",
        corruptTarget,
        ...bin,
      ],
      1,
    );
    const exists = await maintenance.$queryRaw<
      Array<{ datname: string }>
    >`SELECT datname FROM pg_database WHERE datname=${corruptTarget}`;
    assert.equal(exists.length, 0);
    assert.equal(
      (await db.product.findUniqueOrThrow({ where: { id: product.id } })).name,
      product.name,
    );
    assert.equal(
      (
        await db.variant.findUniqueOrThrow({
          where: { id: product.variants[0].id },
        })
      ).stock,
      23,
    );
    console.log(
      "Launch integration passed: fresh provisioning, preserved pricing, no account promotion, sample rejection, owner onboarding, UTF8 stock snapshot restore, reordered sidecar, existing-target and corrupt-backup rejection.",
    );
  } finally {
    await target?.$disconnect();
    await db.$disconnect();
    // Only the randomly named databases created by this test are removed.
    if (created) {
      for (const database of [restored, name]) {
        const exists = await maintenance.$queryRaw<
          Array<{ datname: string }>
        >`SELECT datname FROM pg_database WHERE datname=${database}`;
        if (exists.length)
          await maintenance.$executeRawUnsafe(`DROP DATABASE "${database}"`);
      }
    }
    await maintenance.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Launch integration failed",
  );
  process.exitCode = 1;
});
