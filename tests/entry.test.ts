import { test } from "node:test";
import assert from "node:assert/strict";
import { buyerDestination } from "../apps/web/src/lib/auth-entry";
import type { SessionUser } from "@wholesale/shared";
const buyer = { role: "SELLER" } as SessionUser;
test("Buyer product references survive login without external or other-role redirects", () => {
  assert.equal(buyerDestination(buyer, "/seller/products/product-1"), "/seller/products/product-1");
  for (const url of ["https://example.test", "//example.test", "/admin", "/seller\\evil", "/sellerevil", "/seller%2f%2fevil"]) {
    assert.equal(buyerDestination(buyer, url), null);
  }
  assert.equal(buyerDestination({ role: "WHOLESALER_OWNER" } as SessionUser, "/seller/products/product-1"), null);
});
