import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Module,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { z } from "zod";
import { type SessionUser } from "@wholesale/shared";
import { AllowRoles, AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { Database, audit, notify } from "./database";
import { parse } from "./validation";

export function subscriptionState(
  business: {
    subscriptionStartsAt: Date;
    subscriptionEndsAt: Date;
    subscriptionTrial: boolean;
  },
  now = new Date(),
) {
  return {
    status:
      business.subscriptionEndsAt <= now
        ? ("EXPIRED" as const)
        : business.subscriptionTrial
          ? ("TRIAL" as const)
          : ("ACTIVE" as const),
    startsAt: business.subscriptionStartsAt.toISOString(),
    endsAt: business.subscriptionEndsAt.toISOString(),
  };
}
export function assertSubscription(business: { subscriptionEndsAt: Date }) {
  if (business.subscriptionEndsAt <= new Date())
    throw new ForbiddenException(
      "Your subscription has expired. Renew to add products, stock, staff or new bills. Existing records remain accessible.",
    );
}
export function periodEnd(start: Date, cycle: "MONTHLY" | "YEARLY") {
  // Calendar periods, clamped to the last day (Jan 31 -> Feb 28/29).
  const end = new Date(start);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  if (cycle === "YEARLY") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  const last = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();
  end.setUTCDate(Math.min(day, last));
  return end;
}
const renewalSchema = z
  .object({
    requestKey: z.string().uuid(),
    planId: z.string().min(1),
    cycle: z.enum(["MONTHLY", "YEARLY"]),
    amountPaise: z.number().int().min(0).max(100000000),
    paymentMode: z.enum(["CASH", "UPI", "BANK", "COMPLIMENTARY"]),
    paymentReference: z.string().trim().min(3).max(120),
    note: z.string().trim().max(500).default(""),
  })
  .refine(
    (v) =>
      v.paymentMode === "COMPLIMENTARY"
        ? v.amountPaise === 0 && v.note.length >= 3
        : v.amountPaise > 0,
    "Record a positive received payment, or a zero-value complimentary period with a reason",
  );
@Injectable()
export class SubscriptionService {
  constructor(@Inject(Database) private readonly db: Database) {}
  async detail(businessId: string) {
    const business = await this.db.business.findUniqueOrThrow({
      where: { id: businessId },
      include: { plan: true },
    });
    const [periods, plans] = await Promise.all([
      this.db.subscriptionPeriod.findMany({
        where: { businessId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.db.plan.findMany({
        where: { active: true },
        orderBy: { monthlyPricePaise: "asc" },
      }),
    ]);
    return {
      ...subscriptionState(business),
      plan: business.plan,
      periods,
      plans,
    };
  }
  async renew(actor: SessionUser, businessId: string, body: unknown) {
    const input = parse(renewalSchema, body);
    const requestHash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    return this.db.serial(async (tx) => {
      const business = await tx.business.update({
        where: { id: businessId },
        data: { revision: { increment: 1 } },
        include: {
          _count: {
            select: {
              products: { where: { moderation: { not: "ARCHIVED" } } },
              staff: { where: { active: true } },
            },
          },
        },
      });
      const existing = await tx.subscriptionPeriod.findUnique({
        where: {
          businessId_requestKey: { businessId, requestKey: input.requestKey },
        },
      });
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new BadRequestException(
            "Renewal request key was already used with different details",
          );
        return existing;
      }
      const plan = await tx.plan.findFirst({
        where: { id: input.planId, active: true },
      });
      if (!plan) throw new BadRequestException("Choose an active plan");
      if (
        business._count.products > plan.productLimit ||
        business._count.staff > plan.staffLimit
      )
        throw new BadRequestException(
          "Current product or staff usage exceeds this plan. Reduce usage before downgrading.",
        );
      if (
        input.cycle === "YEARLY" &&
        plan.yearlyPricePaise === 0 &&
        input.paymentMode !== "COMPLIMENTARY"
      )
        throw new BadRequestException(
          "Set yearly pricing for this plan before recording a yearly collection",
        );
      const now = new Date();
      const startsAt =
        !business.subscriptionTrial && business.subscriptionEndsAt > now
          ? business.subscriptionEndsAt
          : now;
      const endsAt = periodEnd(startsAt, input.cycle);
      const period = await tx.subscriptionPeriod.create({
        data: {
          ...input,
          requestHash,
          businessId,
          actorId: actor.id,
          planName: plan.name,
          startsAt,
          endsAt,
        },
      });
      await tx.business.update({
        where: { id: businessId },
        data: {
          planId: plan.id,
          subscriptionTrial: false,
          subscriptionStartsAt: startsAt,
          subscriptionEndsAt: endsAt,
        },
      });
      await audit(
        tx,
        actor.id,
        businessId,
        "SUBSCRIPTION_RENEWED",
        period.id,
        `${plan.name} · ${input.cycle} · ${input.amountPaise} paise · ${input.paymentReference}`,
      );
      await notify(
        tx,
        businessId,
        null,
        "Subscription renewed",
        `${plan.name} is active until ${endsAt.toISOString().slice(0, 10)}.`,
        "/dashboard/subscription",
      );
      return period;
    });
  }
}
@Controller("v1/subscription")
@UseGuards(SessionGuard)
@AllowRoles("WHOLESALER_OWNER")
export class SubscriptionController {
  constructor(
    @Inject(SubscriptionService) private readonly service: SubscriptionService,
  ) {}
  @Get() detail(@Req() req: AuthRequest) {
    return this.service.detail(req.actor.businessId!);
  }
}
@Controller("v1/platform/businesses/:businessId/subscription")
@UseGuards(SessionGuard)
@AllowRoles("PLATFORM_ADMIN")
export class PlatformSubscriptionController {
  constructor(
    @Inject(SubscriptionService) private readonly service: SubscriptionService,
  ) {}
  @Get() detail(@Param("businessId") id: string) {
    return this.service.detail(id);
  }
  @Post() renew(
    @Req() req: AuthRequest,
    @Param("businessId") id: string,
    @Body() body: unknown,
  ) {
    return this.service.renew(req.actor, id, body);
  }
}
@Module({
  imports: [AuthModule],
  providers: [SubscriptionService],
  controllers: [SubscriptionController, PlatformSubscriptionController],
})
export class SubscriptionModule {}
