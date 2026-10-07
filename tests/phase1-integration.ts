import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Database } from "../apps/api/src/database";
import { BillingService } from "../apps/api/src/billing";
import { CatalogService, InventoryService } from "../apps/api/src/catalog";
import { ReservationService } from "../apps/api/src/reservations";
import { StockImportService } from "../apps/api/src/stock-import";
import { SubscriptionService } from "../apps/api/src/subscriptions";
import { OperationsService } from "../apps/api/src/operations";
import { DeliveryService } from "../apps/api/src/notification-delivery";
import { PlatformService } from "../apps/api/src/platform";
import { SourcingService } from "../apps/api/src/sourcing";
import { MarketplaceService } from "../apps/api/src/marketplace";
import { actions, modules, type SessionUser } from "@wholesale/shared";
const db = new Database(),
  billing = new BillingService(db),
  catalog = new CatalogService(db),
  inventory = new InventoryService(db),
  reservations = new ReservationService(db),
  stockImport = new StockImportService(db),
  subscriptions = new SubscriptionService(db),
  operations = new OperationsService(db),
  delivery = new DeliveryService(db),
  platform = new PlatformService(db, catalog),
  sourcing = new SourcingService(db),
  market = new MarketplaceService(db);
const tag = randomUUID().slice(0, 8),
  users: string[] = [],
  businesses: string[] = [];
let planId = "";
const permission = modules.flatMap((m) =>
  actions.map((a) => `${m}:${a}` as const),
);
function actor(
  user: { id: string; phone: string; name: string; role: string },
  businessId: string | null,
  sellerId: string | null = null,
): SessionUser {
  return {
    ...user,
    role: user.role as SessionUser["role"],
    businessId,
    sellerId,
    businessName: "Phase 1 test",
    permissions: permission,
    onboardingRequired: false,
    verificationStatus: "VERIFIED",
    plan: {
      name: "Phase 1 test",
      monthlyPricePaise: 1000,
      staffLimit: 3,
      productLimit: 50,
      bulkImport: true,
      advancedReports: true,
    },
  };
}
async function user(role: SessionUser["role"], n: number) {
  const u = await db.user.create({
    data: {
      phone: `97${String(Date.now()).slice(-6)}${String(n).padStart(2, "0")}`,
      name: `Phase1 ${tag} ${role}`,
      role,
    },
  });
  users.push(u.id);
  return u;
}
const bill = (
  variantId: string,
  quantity: number,
  buyerPhone: string,
  reservationId?: string,
) => ({
  requestKey: randomUUID(),
  buyerName: "Test Buyer",
  buyerPhone,
  items: [
    {
      variantId,
      quantity,
      unitPricePaise: 10000,
      ...(reservationId ? { reservationId } : {}),
    },
  ],
  paymentMode: "CREDIT",
  paidPaise: 0,
});
async function main() {
  try {
    await db.$connect();
    const plan = await db.plan.create({
      data: {
        name: `Phase1-${tag}`,
        monthlyPricePaise: 1000,
        yearlyPricePaise: 10000,
        staffLimit: 3,
        productLimit: 50,
        bulkImport: true,
        advancedReports: true,
      },
    });
    planId = plan.id;
    const owner = await user("WHOLESALER_OWNER", 1),
      otherOwner = await user("WHOLESALER_OWNER", 2),
      admin = await user("PLATFORM_ADMIN", 3),
      ops = await user("PLATFORM_OPERATIONS", 4),
      buyerUser = await user("SELLER", 5);
    const createBusiness = async (u: typeof owner) => {
      const b = await db.business.create({
        data: {
          ownerId: u.id,
          planId: plan.id,
          name: `Phase1 ${tag} ${u.id}`,
          phone: u.phone,
          address: "Integration fixture address",
          city: "Surat",
          marketArea: "Test",
          categories: ["Kurtis"],
          verificationStatus: "VERIFIED",
        },
      });
      businesses.push(b.id);
      return b;
    };
    const shop = await createBusiness(owner),
      other = await createBusiness(otherOwner),
      a = actor(owner, shop.id),
      b = actor(otherOwner, other.id),
      adminActor = actor(admin, null),
      opsActor = actor(ops, null);
    const buyer = await db.seller.create({
        data: {
          userId: buyerUser.id,
          businessName: `Test buyer ${tag}`,
          city: "Surat",
          verificationStatus: "VERIFIED",
        },
      }),
      buyerActor = actor(buyerUser, null, buyer.id);
    const productInput = {
      name: "Phase 1 कपड़ा test kurti",
      sku: `P1-${tag}`.toUpperCase(),
      category: "Kurtis",
      pricePaise: 10000,
      variants: [{ size: "M", color: "Blue", stock: 10, lowStockAt: 2 }],
    };
    const product = await catalog.create(a, productInput),
      variant = product.variants[0];
    await db.product.update({
      where: { id: product.id },
      data: { moderation: "APPROVED" },
    });
    const holdBody = {
      requestKey: randomUUID(),
      variantId: variant.id,
      buyerName: "Test Buyer",
      buyerPhone: buyerUser.phone,
      quantity: 8,
      hours: 24,
      note: "Integration reservation",
    };
    const hold = await reservations.create(a, holdBody);
    assert.equal(
      (await reservations.create(a, holdBody)).id,
      hold.id,
      "hold retry must be idempotent",
    );
    await assert.rejects(
      () => reservations.create(a, { ...holdBody, hours: 48 }),
      /request key/,
    );
    await assert.rejects(
      () => reservations.create(b, { ...holdBody, requestKey: randomUUID() }),
      /not found/i,
    );
    assert.equal(
      (await market.one(product.id)).stock,
      2,
      "public stock must exclude holds",
    );
    await assert.rejects(
      () => billing.create(a, bill(variant.id, 3, otherOwner.phone)),
      /Insufficient stock/,
    );
    await assert.rejects(
      () =>
        inventory.move(a, {
          requestKey: randomUUID(),
          variantId: variant.id,
          type: "STOCK_OUT",
          quantity: -3,
          note: "Cannot remove held stock",
        }),
      /reserved/,
    );
    await assert.rejects(
      () => billing.create(a, bill(variant.id, 8, otherOwner.phone, hold.id)),
      /another buyer/,
    );
    const heldInvoice = await billing.create(
      a,
      bill(variant.id, 8, buyerUser.phone, hold.id),
    );
    let balance = await db.variant.findUniqueOrThrow({
      where: { id: variant.id },
    });
    assert.equal(balance.stock, 2);
    assert.equal(balance.reserved, 0);
    assert.equal(
      (await db.stockReservation.findUniqueOrThrow({ where: { id: hold.id } }))
        .status,
      "CONSUMED",
    );
    const otherHold = await reservations.create(a, {
      ...holdBody,
      requestKey: randomUUID(),
      quantity: 1,
      buyerPhone: otherOwner.phone,
    });
    await billing.returnItems(a, heldInvoice.id, {
      requestKey: randomUUID(),
      reason: "Returned one held unit",
      items: [{ itemId: heldInvoice.items[0].id, quantity: 1 }],
    });
    const returnMovement = await db.stockMovement.findFirstOrThrow({
      where: { businessId: shop.id, type: "RETURN" },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(
      returnMovement.reservedAfter,
      1,
      "returns preserve the remaining buyer hold in the ledger",
    );
    await reservations.release(a, otherHold.id);
    await billing.cancel(a, heldInvoice.id, {
      reason: "Cancel remainder after return",
    });
    balance = await db.variant.findUniqueOrThrow({ where: { id: variant.id } });
    assert.equal(balance.stock, 10);
    assert.equal(balance.reserved, 0);
    const exp = await reservations.create(a, {
      ...holdBody,
      quantity: 2,
      requestKey: randomUUID(),
    });
    await db.stockReservation.update({
      where: { id: exp.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await reservations.expire(shop.id);
    assert.equal(
      (await db.variant.findUniqueOrThrow({ where: { id: variant.id } }))
        .reserved,
      0,
    );
    const race = await Promise.allSettled([
      reservations.create(a, { ...holdBody, requestKey: randomUUID() }),
      billing.create(a, bill(variant.id, 5, buyerUser.phone)),
    ]);
    assert.equal(
      race.filter((r) => r.status === "fulfilled").length,
      1,
      "billing and hold cannot both claim the same units",
    );
    for (const r of await db.stockReservation.findMany({
      where: { businessId: shop.id, status: "ACTIVE" },
    }))
      await reservations.release(a, r.id);
    for (const i of await db.invoice.findMany({
      where: { businessId: shop.id, status: "ISSUED" },
    }))
      await billing.cancel(a, i.id, { reason: "Restore concurrency fixture" });
    const stockBody = {
      requestKey: randomUUID(),
      type: "PURCHASE",
      note: "Purchase fixture",
      rows: [{ sku: product.sku, size: "M", color: "Blue", quantity: 5 }],
    };
    assert.equal((await stockImport.preview(a, stockBody)).rows[0].after, 15);
    await stockImport.commit(a, stockBody);
    await stockImport.commit(a, stockBody);
    assert.equal(
      (await db.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
      15,
      "import retry must not double stock",
    );
    await assert.rejects(
      () =>
        stockImport.commit(a, {
          ...stockBody,
          requestKey: randomUUID(),
          rows: [
            ...stockBody.rows,
            { sku: "MISSING", size: "M", color: "Blue", quantity: 10 },
          ],
        }),
      /not found/,
    );
    assert.equal(
      (await db.variant.findUniqueOrThrow({ where: { id: variant.id } })).stock,
      15,
      "one bad row must roll back the entire stock batch",
    );
    const imported = {
      requestKey: randomUUID(),
      products: [{ ...productInput, sku: `BULK-${tag}`.toUpperCase() }],
    };
    await catalog.import(a, imported);
    await catalog.import(a, imported);
    assert.equal(
      await db.product.count({
        where: { businessId: shop.id, sku: imported.products[0].sku },
      }),
      1,
    );
    await db.business.update({
      where: { id: shop.id },
      data: { subscriptionEndsAt: new Date(Date.now() - 1000) },
    });
    await assert.rejects(
      () => billing.create(a, bill(variant.id, 1, buyerUser.phone)),
      /expired/,
    );
    await assert.rejects(
      () =>
        catalog.create(a, {
          ...productInput,
          sku: `EXPIRED-${tag}`.toUpperCase(),
        }),
      /expired/,
    );
    const renewal = {
      requestKey: randomUUID(),
      planId: plan.id,
      cycle: "MONTHLY",
      amountPaise: 1000,
      paymentMode: "UPI",
      paymentReference: `TEST-${tag}`,
      note: "Received fixture payment",
    };
    const period = await subscriptions.renew(adminActor, shop.id, renewal);
    assert.equal(
      (await subscriptions.renew(adminActor, shop.id, renewal)).id,
      period.id,
    );
    assert.equal((await subscriptions.detail(shop.id)).status, "ACTIVE");
    assert.equal(
      await db.subscriptionPeriod.count({ where: { businessId: shop.id } }),
      1,
    );
    await assert.rejects(
      () =>
        subscriptions.renew(adminActor, shop.id, {
          ...renewal,
          amountPaise: 2000,
        }),
      /request key/,
    );
    const task = await operations.task(opsActor, shop.id, null, {
      title: "Catalog setup",
      category: "CATALOG",
      assigneeId: ops.id,
    });
    await assert.rejects(
      () => operations.stage(opsActor, shop.id, { stage: "READY" }),
      /requires/,
    );
    await operations.task(opsActor, shop.id, task.id, {
      title: "Catalog setup",
      category: "CATALOG",
      assigneeId: ops.id,
      status: "DONE",
    });
    await assert.rejects(
      () =>
        operations.task(opsActor, shop.id, task.id, {
          title: "Catalog setup",
          category: "CATALOG",
          assigneeId: owner.id,
        }),
      /platform team/,
    );
    await sourcing.saveSupplier(buyerActor, shop.id, { favorite: true });
    assert.equal(
      (await sourcing.suppliers(buyerActor)).find((s) => s.id === shop.id)
        ?.favorite,
      true,
    );
    await delivery.save(buyerActor, {
      sms: false,
      whatsapp: false,
      email: true,
      emailAddress: "fixture@example.invalid",
      newArrivals: true,
      stockAlerts: false,
      inquiryAlerts: true,
      paymentReminders: true,
    });
    const upload = await db.upload.create({
      data: {
        businessId: shop.id,
        userId: owner.id,
        kind: "PRODUCT",
        mime: "image/webp",
        fileName: "fixture.webp",
        storageKey: `test-${tag}.webp`,
        size: 1,
        productId: product.id,
      },
    });
    await db.product.update({
      where: { id: product.id },
      data: { moderation: "PENDING", publishedAt: null },
    });
    await platform.reviewProduct(adminActor, product.id, {
      expectedVersion: (await db.product.findUniqueOrThrow({ where: { id: product.id } })).catalogVersion,
      status: "APPROVED",
    });
    await platform.reviewProduct(adminActor, product.id, {
      expectedVersion: (await db.product.findUniqueOrThrow({ where: { id: product.id } })).catalogVersion,
      status: "APPROVED",
    });
    assert.equal(
      await db.notificationDelivery.count({
        where: { userId: buyerUser.id, topic: "newArrivals" },
      }),
      1,
      "new arrival must enqueue only once",
    );
    await operations.stage(opsActor, shop.id, { stage: "READY" });
    assert.equal(
      (await operations.detail(shop.id)).business.onboardingStage,
      "READY",
    );
    const unpaid = await billing.create(
      a,
      bill(variant.id, 1, buyerUser.phone),
    );
    await delivery.reminder(a, unpaid.id);
    await delivery.reminder(a, unpaid.id);
    assert.equal(
      await db.notificationDelivery.count({
        where: { userId: buyerUser.id, topic: "paymentReminders" },
      }),
      1,
      "manual reminders are limited per day/channel",
    );
    const previousMode = process.env.NOTIFICATION_MODE;
    process.env.NOTIFICATION_MODE = "local";
    let calls = 0;
    await delivery.process(async () => {
      calls++;
    }, buyerUser.id);
    assert.equal(calls, 0, "local mode must never send externally");
    assert.equal(
      await db.notificationDelivery.count({
        where: { userId: buyerUser.id, status: "NOT_CONFIGURED" },
      }),
      2,
    );
    const previousKey = process.env.RESEND_API_KEY,
      previousFrom = process.env.NOTIFICATION_EMAIL_FROM;
    process.env.NOTIFICATION_MODE = "live";
    process.env.RESEND_API_KEY = "fixture-only";
    process.env.NOTIFICATION_EMAIL_FROM = "fixture@example.invalid";
    await db.notificationDelivery.updateMany({
      where: { userId: buyerUser.id },
      data: { nextAttemptAt: new Date() },
    });
    await delivery.process(async () => {
      calls++;
    }, buyerUser.id);
    assert.equal(calls, 2);
    assert.equal(
      await db.notificationDelivery.count({
        where: { userId: buyerUser.id, status: "ACCEPTED" },
      }),
      2,
    );
    process.env.NOTIFICATION_MODE = previousMode;
    process.env.RESEND_API_KEY = previousKey;
    process.env.NOTIFICATION_EMAIL_FROM = previousFrom;
    await sourcing.discover(buyerActor, { category: "Kurtis", page: "1" });
    await sourcing.discover(buyerActor, { category: "Kurtis", page: "1" });
    assert.equal(
      await db.searchEvent.count({ where: { sellerId: buyer.id } }),
      1,
      "refreshes must not inflate searches",
    );
    assert.ok(
      (await sourcing.rankings()).find((c) => c.category === "Kurtis")!.score >
        0,
    );
    await db.upload.delete({ where: { id: upload.id } });
    console.log(
      "Phase 1 integration passed: reservation/billing concurrency, hold consumption and expiry, returns/cancellation, atomic/idempotent stock/catalog imports, subscription expiry/renewal, assigned onboarding tasks, saved suppliers, opt-in delivery queue and category demand signals.",
    );
  } finally {
    for (const businessId of businesses) {
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
      await db.business.deleteMany({ where: { id: businessId } });
    }
    await db.notification.deleteMany({ where: { userId: { in: users } } });
    await db.notificationDelivery.deleteMany({
      where: { userId: { in: users } },
    });
    await db.seller.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    if (planId) await db.plan.delete({ where: { id: planId } });
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
