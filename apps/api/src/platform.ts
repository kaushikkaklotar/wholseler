import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { planSchema, type SessionUser } from "@wholesale/shared";
import { AllowRoles, AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { Database, audit, notify } from "./database";
import { parse } from "./validation";
import { CatalogModule, CatalogService } from "./catalog";
import { actions, modules } from "@wholesale/shared";
import { queueArrivalDeliveries } from "./delivery-queue";
const reviewSchema = z
  .object({
    status: z.enum(["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"]),
    note: z.string().trim().max(1000).default(""),
  })
  .refine(
    (v) => !["REJECTED", "SUSPENDED"].includes(v.status) || v.note.length >= 3,
    "Add a reason for rejection or suspension",
  );
@Injectable()
export class PlatformService {
  constructor(
    @Inject(Database) private readonly db: Database,
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}
  private async businessActor(actor: SessionUser, id: string) {
    const business = await this.db.business.findFirst({
      where: { id, verificationStatus: { not: "SUSPENDED" } },
      include: { plan: true },
    });
    if (!business) throw new NotFoundException("Active business not found");
    return {
      ...actor,
      businessId: business.id,
      permissions: modules.flatMap((m) =>
        actions.map((a) => `${m}:${a}` as const),
      ),
      plan: business.plan,
    };
  }
  async createCatalog(actor: SessionUser, id: string, body: unknown) {
    return this.catalog.create(await this.businessActor(actor, id), body);
  }
  async overview() {
    const [businesses, sellers, products, tickets, auditLogs, plans] =
      await Promise.all([
        this.db.business.findMany({
          include: {
            owner: { select: { name: true, phone: true } },
            plan: true,
            uploads: {
              where: { kind: "KYC" },
              select: { id: true, fileName: true },
            },
            _count: {
              select: {
                products: { where: { moderation: { not: "ARCHIVED" } } },
                staff: { where: { active: true } },
                invoices: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
        this.db.seller.findMany({
          include: {
            user: {
              select: {
                name: true,
                phone: true,
                uploads: {
                  where: { kind: "KYC" },
                  select: { id: true, fileName: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
        this.db.product.findMany({
          where: { moderation: { not: "ARCHIVED" } },
          include: {
            business: {
              select: { id: true, name: true, verificationStatus: true },
            },
            images: { select: { id: true } },
            _count: { select: { variants: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 500,
        }),
        this.db.supportTicket.count({ where: { status: { not: "RESOLVED" } } }),
        this.db.auditLog.findMany({
          include: {
            actor: { select: { name: true } },
            business: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        this.db.plan.findMany({ orderBy: { monthlyPricePaise: "asc" } }),
      ]);
    return {
      businesses,
      sellers,
      products,
      tickets,
      auditLogs,
      plans,
      pendingBusinesses: businesses.filter(
        (b) => b.verificationStatus === "PENDING",
      ).length,
      pendingSellers: sellers.filter((s) => s.verificationStatus === "PENDING")
        .length,
      pendingProducts: products.filter((p) => p.moderation === "PENDING")
        .length,
    };
  }
  async reviewBusiness(actor: SessionUser, id: string, body: unknown) {
    const input = parse(reviewSchema, body);
    return this.db.serial(async (tx) => {
      const old = await tx.business.findUnique({ where: { id } });
      if (!old) throw new NotFoundException("Business not found");
      const business = await tx.business.update({
        where: { id },
        data: {
          verificationStatus: input.status,
          verificationNote: input.note,
        },
      });
      await audit(
        tx,
        actor.id,
        id,
        "BUSINESS_REVIEW",
        id,
        `${input.status} · ${input.note}`,
      );
      await notify(
        tx,
        id,
        null,
        "Business verification updated",
        input.note || `Your business is ${input.status.toLowerCase()}`,
        "/dashboard/settings",
      );
      if (input.status === "SUSPENDED") {
        const staff = await tx.staff.findMany({
          where: { businessId: id },
          select: { userId: true },
        });
        await tx.session.deleteMany({
          where: {
            userId: { in: [business.ownerId, ...staff.map((s) => s.userId)] },
          },
        });
      }
      return business;
    });
  }
  async reviewSeller(actor: SessionUser, id: string, body: unknown) {
    const input = parse(reviewSchema, body);
    return this.db.serial(async (tx) => {
      const old = await tx.seller.findUnique({ where: { id } });
      if (!old) throw new NotFoundException("Seller not found");
      const seller = await tx.seller.update({
        where: { id },
        data: {
          verificationStatus: input.status,
          verificationNote: input.note,
        },
      });
      await audit(
        tx,
        actor.id,
        null,
        "SELLER_REVIEW",
        id,
        `${input.status} · ${input.note}`,
      );
      await notify(
        tx,
        null,
        seller.userId,
        "Seller verification updated",
        input.note || `Your profile is ${input.status.toLowerCase()}`,
        "/seller",
      );
      if (input.status === "SUSPENDED")
        await tx.session.deleteMany({ where: { userId: seller.userId } });
      return seller;
    });
  }
  async reviewProduct(actor: SessionUser, id: string, body: unknown) {
    const input = parse(
      z
        .object({
          status: z.enum(["APPROVED", "REJECTED", "PENDING"]),
          note: z.string().trim().max(1000).default(""),
        })
        .refine(
          (v) => v.status !== "REJECTED" || v.note.length >= 3,
          "Add a reason for rejection",
        ),
      body,
    );
    return this.db.serial(async (tx) => {
      const p = await tx.product.findFirst({
        where: { id, moderation: { not: "ARCHIVED" } },
        include: { images: true, variants: true },
      });
      if (!p) throw new NotFoundException("Product not found");
      if (
        input.status === "APPROVED" &&
        (!p.images.length || !p.variants.some((v) => !v.archived))
      )
        throw new BadRequestException(
          "Add at least one product image and an active variant before publishing",
        );
      const result = await tx.product.update({
        where: { id },
        data: {
          moderation: input.status,
          moderationNote: input.note,
          ...(input.status === "APPROVED" && !p.publishedAt
            ? { publishedAt: new Date() }
            : {}),
        },
      });
      await audit(
        tx,
        actor.id,
        p.businessId,
        "CATALOG_REVIEW",
        id,
        `${input.status} · ${input.note}`,
      );
      await notify(
        tx,
        p.businessId,
        null,
        "Catalog review updated",
        `${p.name}: ${input.status.toLowerCase()}. ${input.note}`,
        "/dashboard/products",
      );
      const business = await tx.business.findUniqueOrThrow({
        where: { id: p.businessId },
      });
      if (
        input.status === "APPROVED" &&
        !p.publishedAt &&
        business.verificationStatus === "VERIFIED"
      ) {
        const subscribers = await tx.supplierFavorite.findMany({
          where: { businessId: p.businessId },
          include: { seller: { select: { userId: true } } },
        });
        const title = `New arrival · ${business.name}`,
          body = `${p.name} (${p.sku}) is now available in the supplier catalog.`,
          href = `/seller/products/${p.id}`;
        if (subscribers.length) {
          const userIds = subscribers.map((saved) => saved.seller.userId);
          await tx.notification.createMany({
            data: userIds.map((userId) => ({
              businessId: null,
              userId,
              title,
              body,
              href,
              readBy: [],
            })),
          });
          await queueArrivalDeliveries(tx, {
            businessId: p.businessId,
            productId: p.id,
            userIds,
            title,
            body,
            href,
          });
        }
      }
      return result;
    });
  }
  async plan(actor: SessionUser, id: string | null, body: unknown) {
    const input = parse(planSchema, body);
    return this.db.serial(async (tx) => {
      if (id) {
        const businesses = await tx.business.findMany({
          where: { planId: id },
          include: {
            _count: {
              select: {
                staff: { where: { active: true } },
                products: { where: { moderation: { not: "ARCHIVED" } } },
              },
            },
          },
        });
        if (
          businesses.some(
            (b) =>
              b._count.staff > input.staffLimit ||
              b._count.products > input.productLimit,
          )
        )
          throw new BadRequestException(
            "Existing businesses exceed these limits. Change their plans or reduce usage before lowering the caps",
          );
      }
      const plan = id
        ? await tx.plan.update({ where: { id }, data: input })
        : await tx.plan.create({ data: input });
      await audit(
        tx,
        actor.id,
        null,
        "PLAN_UPDATED",
        plan.id,
        `${plan.name} · ${plan.staffLimit} staff / ${plan.productLimit} products`,
      );
      return plan;
    });
  }
  async assignPlan(actor: SessionUser, id: string, body: unknown) {
    const input = parse(z.object({ planId: z.string() }), body);
    return this.db.serial(async (tx) => {
      const business = await tx.business.update({
        where: { id },
        data: { revision: { increment: 1 } },
        include: {
          _count: {
            select: {
              staff: { where: { active: true } },
              products: { where: { moderation: { not: "ARCHIVED" } } },
            },
          },
        },
      });
      const plan = await tx.plan.findFirst({
        where: { id: input.planId, active: true },
      });
      if (!plan) throw new BadRequestException("Plan is not available");
      if (
        business._count.staff > plan.staffLimit ||
        business._count.products > plan.productLimit
      )
        throw new BadRequestException(
          "Current usage exceeds this plan's limits. Reduce usage before downgrading",
        );
      await tx.business.update({ where: { id }, data: { planId: plan.id } });
      await audit(tx, actor.id, id, "SUBSCRIPTION_UPDATED", id, plan.name);
      return { ok: true };
    });
  }
  async operationsNote(actor: SessionUser, id: string, body: unknown) {
    const input = parse(z.object({ note: z.string().trim().max(2000) }), body);
    return this.db.serial(async (tx) => {
      const business = await tx.business.update({
        where: { id },
        data: { onboardingNote: input.note },
      });
      await audit(tx, actor.id, id, "ONBOARDING_NOTE", id, input.note);
      return business;
    });
  }
}
@Controller("v1/platform")
@UseGuards(SessionGuard)
@AllowRoles("PLATFORM_ADMIN", "PLATFORM_OPERATIONS")
export class PlatformController {
  constructor(
    @Inject(PlatformService) private readonly service: PlatformService,
  ) {}
  @Get() get() {
    return this.service.overview();
  }
  @Post("businesses/:id/products") createCatalog(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.createCatalog(req.actor, id, body);
  }
  @Patch("businesses/:id/review") @AllowRoles("PLATFORM_ADMIN") business(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.reviewBusiness(req.actor, id, body);
  }
  @Patch("sellers/:id/review") @AllowRoles("PLATFORM_ADMIN") seller(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.reviewSeller(req.actor, id, body);
  }
  @Patch("products/:id/review") @AllowRoles("PLATFORM_ADMIN") product(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.reviewProduct(req.actor, id, body);
  }
  @Post("plans") @AllowRoles("PLATFORM_ADMIN") createPlan(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.plan(req.actor, null, body);
  }
  @Patch("plans/:id") @AllowRoles("PLATFORM_ADMIN") editPlan(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.plan(req.actor, id, body);
  }
  @Patch("businesses/:id/plan") @AllowRoles("PLATFORM_ADMIN") assign(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.assignPlan(req.actor, id, body);
  }
  @Patch("businesses/:id/onboarding") note(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.operationsNote(req.actor, id, body);
  }
}
@Module({
  imports: [AuthModule, CatalogModule],
  providers: [PlatformService],
  controllers: [PlatformController],
})
export class PlatformModule {}
