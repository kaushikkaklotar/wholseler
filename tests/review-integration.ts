import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { actions, modules, type SessionUser } from "@wholesale/shared";
import { Database } from "../apps/api/src/database";
import { CatalogService } from "../apps/api/src/catalog";
import { PlatformService } from "../apps/api/src/platform";
import { PlatformTeamService } from "../apps/api/src/platform-team";
import { OperationsService } from "../apps/api/src/operations";
import { AuthService } from "../apps/api/src/auth";
const db = new Database(), catalog = new CatalogService(db), platform = new PlatformService(db, catalog), team = new PlatformTeamService(db), operations = new OperationsService(db), auth = new AuthService(db);
const tag = randomUUID().slice(0,8), userIds: string[] = [], phones: string[] = [];
let businessId = "", planId = "";
function actor(user: { id: string; name: string; phone: string; role: string }, businessId: string | null): SessionUser {
  return { ...user, role: user.role as SessionUser["role"], businessId, sellerId: null, businessName: "Review test", onboardingRequired: false, verificationStatus: "VERIFIED", permissions: modules.flatMap(m => actions.map(a => `${m}:${a}` as const)), plan: { name: "Review test", monthlyPricePaise: 1000, staffLimit: 3, productLimit: 30, bulkImport: true, advancedReports: true } };
}
async function main() {
  try {
    const users = await Promise.all(["WHOLESALER_OWNER", "PLATFORM_ADMIN", "PLATFORM_OPERATIONS"].map(async (role, n) => { const phone = `98${String(Date.now()).slice(-6)}${n}1`; phones.push(phone); const u = await db.user.create({ data: { name: `Review ${tag} ${role}`, phone, role: role as SessionUser["role"] } }); userIds.push(u.id); return u; }));
    const [owner, admin, ops] = users;
    const plan = await db.plan.create({ data: { name: `Review ${tag}`, monthlyPricePaise: 1000, yearlyPricePaise: 10000, staffLimit: 3, productLimit: 30, bulkImport: true, advancedReports: true } }); planId = plan.id;
    const business = await db.business.create({ data: { name: `Review ${tag}`, ownerId: owner.id, planId, phone: owner.phone, address: "Isolated review test", city: "Surat", marketArea: "Test", categories: ["Toys"], verificationStatus: "VERIFIED" } }); businessId = business.id;
    const a = actor(owner, businessId), adminActor = actor(admin, null), opsActor = actor(ops, null);
    const pictures = await Promise.all(Array.from({ length: 6 }, (_, n) => db.upload.create({ data: { businessId, userId: owner.id, kind: "PRODUCT", mime: "image/webp", size: 10, storageKey: `${tag}-${n}.webp`, fileName: `${n}.webp` } })));
    const product = await catalog.create(a, { name: "Toy review test", sku: `TOY-${tag}`.toUpperCase(), category: "Toys", pricePaise: 50000, imageIds: [pictures[0].id], variants: [{ size: "M", color: "Blue", stock: 10, lowStockAt: 2 }] });
    assert.equal(await db.productRevision.count({ where: { productId: product.id } }), 1);
    await platform.reviewProduct(adminActor, product.id, { status: "APPROVED", expectedVersion: product.catalogVersion });
    const update = async (extra = {}) => { const p = await catalog.one(a, product.id); return catalog.update(a, product.id, { ...p, imageIds: p.images.map(i => i.id), ...extra }); };
    const updated = await update({ imageIds: pictures.map(p => p.id) });
    assert.equal(updated.moderation, "PENDING");
    let review = await platform.catalogReview(product.id);
    assert.equal(review.images.added.length, 5); assert.equal(review.images.retained.length, 1);
    assert.match(review.history[0].summary, /5 added.*1 → 6/); assert.equal(review.history[0].actor, owner.name);
    assert.equal(review.comparisonLabel, "Changes since last approval");
    await assert.rejects(() => platform.reviewProduct(adminActor, product.id, { status: "APPROVED", expectedVersion: product.catalogVersion }), /Product changed/);
    await assert.rejects(() => platform.reviewProduct(adminActor, product.id, { status: "APPROVED" }), /expectedVersion|required/i);
    const revisions = review.history.length, notices = await db.notification.count({ where: { businessId } });
    assert.equal((await update()).catalogVersion, updated.catalogVersion);
    assert.equal((await platform.catalogReview(product.id)).history.length, revisions);
    assert.equal(await db.notification.count({ where: { businessId } }), notices);
    const priced = await update({ pricePaise: 60000 });
    review = await platform.catalogReview(product.id);
    assert.equal(review.images.added.length, 5, "comparison keeps all edits since approval, not just the latest edit");
    assert.ok(review.changes.find(row => row.field === "pricePaise"));
    await platform.reviewProduct(adminActor, product.id, { status: "REJECTED", expectedVersion: priced.catalogVersion, note: "Photo needs correction" });
    assert.equal((await platform.catalogReview(product.id)).history[0].decision, "REJECTED");
    await platform.reviewProduct(adminActor, product.id, { status: "APPROVED", expectedVersion: priced.catalogVersion });
    const unchanged = await update(); assert.equal(unchanged.moderation, "APPROVED");
    await update({ imageIds: [pictures[0].id] });
    const historyPicture = await db.upload.findUniqueOrThrow({ where: { id: pictures[1].id }, include: { catalogRevisions: true } });
    assert.equal(historyPicture.productId, null); assert.ok(historyPicture.catalogRevisions.length);
    assert.equal((await platform.catalogReview(product.id)).images.removed.length, 5);
    await assert.rejects(() => update({ imageIds: ["other-business-image"] }), /do not belong/);
    await assert.rejects(() => update({ variants: [{ ...product.variants[0], stock: 11 }] }), /Stock changed/);
    assert.equal((await db.variant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock, 10);
    const phone = `98${String(Date.now()).slice(-6)}91`; phones.push(phone);
    const member = await team.save(adminActor, null, { name: "New Operations member", phone, active: true }); userIds.push(member.id);
    assert.ok((await operations.detail(businessId)).team.some(u => u.id === member.id));
    await operations.task(adminActor, businessId, null, { title: "Complete catalog", category: "CATALOG", assigneeId: member.id });
    const challenge = await auth.request({ phone, portal: "TEAM", intent: "LOGIN", accountType: "WHOLESALER_OWNER" });
    let token = "";
    await auth.verify({ challengeId: challenge.challengeId, code: challenge.developmentCode! }, { cookie: (_name: string, value: string) => { token = value; } } as unknown as Response);
    assert.equal((await auth.current(token))?.role, "PLATFORM_OPERATIONS");
    await team.save(adminActor, member.id, { name: "Renamed Operations", phone, active: false });
    assert.equal(await auth.current(token), null);
    assert.ok(!(await operations.detail(businessId)).team.some(u => u.id === member.id));
    assert.equal((await team.list(adminActor)).find(u => u.id === member.id)?.openTasks, 1);
    await assert.rejects(() => team.save(opsActor, null, { name: "Escalation", phone: "9876509999" }), /Only platform administrators/);
    await assert.rejects(() => team.list(a), /Only platform administrators/);
    await assert.rejects(() => team.save(adminActor, null, { name: "Hijack", phone: owner.phone }), /another account/);
    await assert.rejects(() => team.save(adminActor, owner.id, { name: "Hijack", phone: owner.phone }), /not found/);
    await assert.rejects(() => team.save(adminActor, null, { name: "Promote", phone: "9876509999", role: "PLATFORM_ADMIN" }), /Unrecognized|role/i);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner.id } })).role, "WHOLESALER_OWNER");
    console.log("Review/team integration passed: exact and cumulative comparisons, no-op preservation, retained image history, stale approvals, stock/tenant guards, Operations provisioning and OTP, task assignment, disabled sessions, collision and role-escalation rejection.");
  } finally {
    if (businessId) {
      await db.notification.deleteMany({ where: { businessId } }); await db.auditLog.deleteMany({ where: { businessId } });
      await db.onboardingTask.deleteMany({ where: { businessId } }); await db.stockMovement.deleteMany({ where: { businessId } });
      await db.upload.deleteMany({ where: { businessId } }); await db.variant.deleteMany({ where: { businessId } }); await db.product.deleteMany({ where: { businessId } }); await db.business.deleteMany({ where: { id: businessId } });
    }
    await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } }); await db.notification.deleteMany({ where: { userId: { in: userIds } } });
    await db.otpChallenge.deleteMany({ where: { phone: { in: phones } } }); await db.user.deleteMany({ where: { id: { in: userIds } } });
    if (planId) await db.plan.delete({ where: { id: planId } }); await db.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
