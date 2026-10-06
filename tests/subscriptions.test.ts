import { test } from "node:test";
import assert from "node:assert/strict";
import { periodEnd } from "../apps/api/src/subscriptions";
import { panSchema, sellerSchema } from "@wholesale/shared";
test("Calendar renewals clamp month ends and leap days without skipping a month", () => {
  assert.equal(
    periodEnd(new Date("2026-01-31T10:30:00Z"), "MONTHLY").toISOString(),
    "2026-02-28T10:30:00.000Z",
  );
  assert.equal(
    periodEnd(new Date("2024-01-31T10:30:00Z"), "MONTHLY").toISOString(),
    "2024-02-29T10:30:00.000Z",
  );
  assert.equal(
    periodEnd(new Date("2024-02-29T10:30:00Z"), "YEARLY").toISOString(),
    "2025-02-28T10:30:00.000Z",
  );
});
test("Optional identity fields stay optional and PAN / selling channels reject malformed values", () => {
  assert.equal(panSchema.parse(""), "");
  assert.equal(panSchema.parse("abcde1234f"), "ABCDE1234F");
  assert.equal(panSchema.safeParse("not-pan").success, false);
  assert.equal(
    sellerSchema.safeParse({
      name: "Buyer",
      businessName: "Buyer Shop",
      city: "Surat",
      marketplaceChannels: ["Unrecognised"],
    }).success,
    false,
  );
});
