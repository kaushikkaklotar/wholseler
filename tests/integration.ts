import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Database } from "../apps/api/src/database";
import { BillingService } from "../apps/api/src/billing";
import type { SessionUser } from "@wholesale/shared";

const db = new Database();
const billing = new BillingService(db);
const suffix = randomUUID().slice(0, 8);
const phone = (tail: string) =>
  `98${suffix.replace(/\D/g, "").padEnd(6, "7").slice(0, 6)}${tail}`;
const ids: { users: string[]; businesses: string[] } = {
  users: [],
  businesses: [],
};

async function fixture(label: string) {
  const plan = await db.plan.findFirstOrThrow({ where: { active: true } });
  const user = await db.user.create({
    data: {
      name: `${label} Owner`,
      phone: phone(label === "A" ? "01" : "02"),
      role: "WHOLESALER_OWNER",
    },
  });
  ids.users.push(user.id);
  const business = await db.business.create({
    data: {
      ownerId: user.id,
      planId: plan.id,
      name: `Integration ${label} ${suffix}`,
      phone: user.phone,
      address: "Test address",
      city: "Surat",
      marketArea: "Test market",
      categories: ["Kurtis"],
      verificationStatus: "VERIFIED",
    },
  });
  ids.businesses.push(business.id);
  const product = await db.product.create({
    data: {
      businessId: business.id,
      name: `Race product ${label}`,
      sku: `RACE-${label}-${suffix}`.toUpperCase(),
      category: "Kurtis",
      pricePaise: 10000,
      moq: 1,
      visibility: "PUBLIC",
      moderation: "APPROVED",
      tags: ["integration"],
      variants: {
        create: {
          businessId: business.id,
          size: "M",
          color: "Blue",
          stock: 5,
          lowStockAt: 1,
        },
      },
    },
    include: { variants: true },
  });
  const actor: SessionUser = {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: "WHOLESALER_OWNER",
    businessId: business.id,
    businessName: business.name,
    sellerId: null,
    permissions: [
      "BILLING:VIEW",
      "BILLING:CREATE",
      "BILLING:EDIT",
      "BILLING:DELETE",
    ],
    verificationStatus: "VERIFIED",
    onboardingRequired: false,
  };
  return { actor, variant: product.variants[0] };
}

function invoice(variantId: string, requestKey = randomUUID()) {
  return {
    requestKey,
    buyerName: "Integration Buyer",
    buyerPhone: "9876543210",
    items: [{ variantId, quantity: 3, unitPricePaise: 10000 }],
    discountPaise: 0,
    taxMode: "NONE",
    taxRateBps: 0,
    paidPaise: 0,
    paymentMode: "CREDIT",
    note: "Concurrency verification",
  };
}

async function main() {
  try {
    await db.$connect();
    const a = await fixture("A"),
      b = await fixture("B");
    const concurrent = await Promise.allSettled([
      billing.create(a.actor, invoice(a.variant.id)),
      billing.create(a.actor, invoice(a.variant.id)),
    ]);
    assert.equal(
      concurrent.filter((r) => r.status === "fulfilled").length,
      1,
      "only one competing invoice should commit",
    );
    assert.equal(
      await db.variant
        .findUniqueOrThrow({ where: { id: a.variant.id } })
        .then((v) => v.stock),
      2,
      "stock must remain non-negative and reflect one sale",
    );
    assert.equal(
      await db.invoice.count({ where: { businessId: a.actor.businessId! } }),
      1,
    );

    const key = randomUUID(),
      body = invoice(b.variant.id, key);
    const first = await billing.create(b.actor, body),
      repeated = await billing.create(b.actor, body);
    assert.equal(
      first.id,
      repeated.id,
      "same request key and payload must be idempotent",
    );
    await assert.rejects(
      () => billing.create(b.actor, { ...body, buyerName: "Changed Buyer" }),
      /request key/i,
    );
    await assert.rejects(
      () => billing.create(a.actor, invoice(b.variant.id)),
      /does not belong/i,
    );
    assert.equal(
      await db.stockMovement.count({
        where: { businessId: b.actor.businessId!, type: "BILLING" },
      }),
      1,
      "idempotent replay must not duplicate ledger entries",
    );
    console.log(
      "Integration checks passed: concurrent stock guard, idempotent billing, tenant isolation and ledger uniqueness.",
    );
  } finally {
    for (const businessId of ids.businesses) {
      await db.notification.deleteMany({ where: { businessId } });
      await db.auditLog.deleteMany({ where: { businessId } });
      await db.stockMovement.deleteMany({ where: { businessId } });
      await db.payment.deleteMany({ where: { businessId } });
      await db.returnItem.deleteMany({ where: { return: { businessId } } });
      await db.invoiceReturn.deleteMany({ where: { businessId } });
      await db.invoiceItem.deleteMany({ where: { invoice: { businessId } } });
      await db.inquiry.deleteMany({ where: { businessId } });
      await db.invoice.deleteMany({ where: { businessId } });
      await db.upload.deleteMany({ where: { businessId } });
      await db.variant.deleteMany({ where: { businessId } });
      await db.product.deleteMany({ where: { businessId } });
      await db.staff.deleteMany({ where: { businessId } });
      await db.supportTicket.deleteMany({ where: { businessId } });
      await db.business.deleteMany({ where: { id: businessId } });
    }
    await db.session.deleteMany({ where: { userId: { in: ids.users } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
