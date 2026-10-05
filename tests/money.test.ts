import { test } from "node:test";
import assert from "node:assert/strict";
import {
  invoiceSchema,
  invoiceTotals,
  paymentState,
  returnValue,
  splitLineTotals,
  staffSchema,
  toPaise,
} from "@wholesale/shared";
import { csvCell } from "../apps/api/src/billing";
test("Decimal amounts remain exact paise; unsupported precision is rejected", () => {
  assert.equal(toPaise("19.99"), 1999);
  assert.equal(toPaise("0.05"), 5);
  assert.throws(() => toPaise("19.999"));
  assert.throws(() => toPaise("-1"));
  assert.throws(() => toPaise("1e4"));
});
test("Discount and GST totals allocate every paise across invoice lines", () => {
  const items = [
    { quantity: 3, unitPricePaise: 1999 },
    { quantity: 2, unitPricePaise: 2350 },
  ];
  const totals = invoiceTotals(items, 997, 500);
  assert.equal(totals.subtotalPaise, 10697);
  assert.equal(totals.taxPaise, 485);
  assert.equal(totals.totalPaise, 10185);
  assert.equal(
    splitLineTotals(items, totals.totalPaise).reduce((s, a) => s + a, 0),
    totals.totalPaise,
  );
  assert.throws(() => invoiceTotals(items, 11000, 0));
});
test("Partial returns preserve total paise across rounding boundaries", () => {
  const parts = [
    returnValue(100, 3, 0, 1),
    returnValue(100, 3, 1, 1),
    returnValue(100, 3, 2, 1),
  ];
  assert.deepEqual(parts, [33, 33, 34]);
  assert.equal(
    parts.reduce((s, a) => s + a, 0),
    100,
  );
});
test("Return and cancellation credits never become negative outstanding debt", () => {
  assert.deepEqual(paymentState(10000, 3000, 9000), {
    netPaise: 7000,
    duePaise: 0,
    creditPaise: 2000,
    paymentStatus: "PAID",
  });
  assert.equal(paymentState(10000, 0, 10000, true).creditPaise, 10000);
  assert.equal(paymentState(10000, 0, 0).paymentStatus, "UNPAID");
});
test("Permission changes cannot grant mutation without module view", () => {
  assert.equal(
    staffSchema.safeParse({
      name: "Cashier",
      phone: "9000000021",
      designation: "Cashier",
      permissions: ["BILLING:EDIT"],
    }).success,
    false,
  );
  assert.equal(
    staffSchema.safeParse({
      name: "Cashier",
      phone: "9000000021",
      designation: "Cashier",
      permissions: ["BILLING:VIEW", "BILLING:EDIT"],
    }).success,
    true,
  );
});
test("Invoice validation rejects duplicated variants and excessive discounts", () => {
  const common = {
    requestKey: "f2600c80-bc49-413e-aeed-4faf6af3d2a6",
    buyerName: "Test buyer",
    buyerPhone: "9000000022",
    items: [{ variantId: "x", quantity: 1, unitPricePaise: 100 }],
  };
  assert.equal(
    invoiceSchema.safeParse({
      ...common,
      items: [...common.items, ...common.items],
    }).success,
    false,
  );
  assert.equal(
    invoiceSchema.safeParse({ ...common, discountPaise: 101 }).success,
    false,
  );
});
test("CSV exports neutralise executable spreadsheet text and preserve quotes", () => {
  assert.equal(
    csvCell('=HYPERLINK("https://example.test")'),
    '"\'=HYPERLINK(""https://example.test"")"',
  );
  assert.equal(csvCell("  +SUM(1,2)"), '"\'  +SUM(1,2)"');
  assert.equal(csvCell('Plain "text"'), '"Plain ""text"""');
});
