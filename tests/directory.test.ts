import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { supplierListingSchema } from "../apps/api/src/supplier-directory";

test("Researched supplier data has business contacts and same-site HTTPS provenance, without invented trading data", () => {
  const rows = JSON.parse(readFileSync("packages/db/data/surat-suppliers.json", "utf8")) as unknown[];
  assert.equal(rows.length, 8);
  const checked = rows.map((row) => supplierListingSchema.parse(row));
  assert.equal(new Set(checked.map((row) => row.id)).size, checked.length);
  assert.equal(new Set(checked.map((row) => row.phone)).size, checked.length);
  for (const row of checked) {
    assert.ok(Date.parse(row.checkedAt) <= Date.now());
    for (const extra of [{ stock: 100 }, { pricePaise: 50000 }, { verificationStatus: "VERIFIED" }, { ownerId: "made-up" }])
      assert.equal(supplierListingSchema.safeParse({ ...row, ...extra }).success, false);
    assert.equal(supplierListingSchema.safeParse({ ...row, sourceUrl: "javascript:alert(1)" }).success, false);
    assert.equal(supplierListingSchema.safeParse({ ...row, website: "http://example.test" }).success, false);
  }
});
