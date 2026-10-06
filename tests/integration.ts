import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Database } from "../apps/api/src/database";
import { BillingService } from "../apps/api/src/billing";
import { AuthService } from "../apps/api/src/auth";
import { MarketplaceService } from "../apps/api/src/marketplace";
import type { Response } from "express";
import type { SessionUser } from "@wholesale/shared";

const db = new Database();
const billing = new BillingService(db);
const auth = new AuthService(db);
const market = new MarketplaceService(db);
const authPhones: string[] = [];
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
    // Public discovery must never disclose restricted supplier prices.
    await db.product.update({
      where: { id: b.variant.productId },
      data: { visibility: "APPROVED_SELLERS" },
    });
    const restricted = await market.one(b.variant.productId);
    assert.equal(restricted.pricePaise, null);
    assert.equal("phone" in restricted.business, false);
    assert.equal("businessId" in restricted, false);
    await db.product.update({
      where: { id: b.variant.productId },
      data: { moderation: "PENDING" },
    });
    await assert.rejects(
      () => market.one(b.variant.productId),
      /no longer available/,
    );
    await db.business.update({
      where: { id: a.actor.businessId! },
      data: { verificationStatus: "PENDING" },
    });
    await assert.rejects(
      () => market.one(a.variant.productId),
      /no longer available/,
    );

    if (process.env.AUTH_MODE !== "development")
      throw new Error(
        "Auth integration checks require local development authentication",
      );
    const freshPhone = phone("91");
    authPhones.push(freshPhone);
    await assert.rejects(
      () => auth.request({ phone: freshPhone, intent: "LOGIN" }),
      /No account found/,
    );
    assert.equal(
      await db.user.count({ where: { phone: freshPhone } }),
      0,
      "sign in must not register a new account",
    );
    await assert.rejects(
      () =>
        auth.request({
          phone: a.actor.phone,
          portal: "SELLER",
          accountType: "SELLER",
          intent: "LOGIN",
        }),
      /different workspace/,
    );
    await assert.rejects(
      () => auth.request({ phone: a.actor.phone, intent: "REGISTER" }),
      /already registered/,
    );
    await assert.rejects(
      () =>
        auth.request({ phone: freshPhone, portal: "TEAM", intent: "REGISTER" }),
      /valid account type/,
    );
    const challenge = await auth.request({
      phone: freshPhone,
      intent: "REGISTER",
      portal: "WHOLESALER",
    });
    await assert.rejects(
      () => auth.request({ phone: freshPhone, intent: "REGISTER" }),
      /60 seconds/,
    );
    await assert.rejects(
      () =>
        auth.verify(
          { challengeId: challenge.challengeId, code: "000000" },
          {} as Response,
        ),
      /Incorrect verification code/,
    );
    let token = "";
    const response = {
      cookie: (_name: string, value: string) => {
        token = value;
      },
    } as unknown as Response;
    const signed = await auth.verify(
      { challengeId: challenge.challengeId, code: challenge.developmentCode! },
      response,
    );
    ids.users.push(signed!.id);
    assert.equal(signed!.role, "WHOLESALER_OWNER");
    assert.equal(signed!.onboardingRequired, true);
    await assert.rejects(
      () =>
        auth.verify(
          {
            challengeId: challenge.challengeId,
            code: challenge.developmentCode!,
          },
          response,
        ),
      /expired|already been used/,
    );
    await auth.onboard(signed!, {
      ownerName: "Flow Test Owner",
      name: `Flow Test ${suffix}`,
      phone: freshPhone,
      city: "Surat",
      marketArea: "Test Market",
      address: "Test shop address",
      categories: ["Kurtis"],
      invoicePrefix: "TEST",
    });
    const complete = await auth.current(token);
    ids.businesses.push(complete!.businessId!);
    assert.equal(complete!.onboardingRequired, false);
    assert.equal(complete!.verificationStatus, "PENDING");
    await assert.rejects(() => auth.onboard(complete!, {}), /already set up/);
    console.log(
      "Integration checks passed: stock concurrency, billing idempotency, tenant isolation, public catalog privacy, login/register separation, OTP replay/resend and business onboarding.",
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
    await db.otpChallenge.deleteMany({ where: { phone: { in: authPhones } } });
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
