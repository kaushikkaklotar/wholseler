import { createHash } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { phoneSchema, type SessionUser } from "@wholesale/shared";
import { Ability, AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { activeBusiness } from "./business-policy";
import { Database, audit, notify } from "./database";
import { parse } from "./validation";
const reserveSchema = z.object({
  requestKey: z.string().uuid(),
  variantId: z.string().min(1),
  buyerName: z.string().trim().min(2).max(100),
  buyerPhone: phoneSchema,
  quantity: z.number().int().min(1).max(100000),
  note: z.string().trim().min(3).max(500),
  hours: z.number().int().min(1).max(168),
});

export async function releaseReservation(
  tx: Prisma.TransactionClient,
  id: string,
  actorId: string,
  status: "RELEASED" | "EXPIRED",
) {
  const reservation = await tx.stockReservation.findUniqueOrThrow({
    where: { id },
  });
  if (reservation.status !== "ACTIVE") return reservation;
  const claimed = await tx.stockReservation.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status },
  });
  if (!claimed.count) return reservation;
  const variant = await tx.variant.update({
    where: { id: reservation.variantId },
    data: { reserved: { decrement: reservation.quantity } },
  });
  await tx.stockMovement.create({
    data: {
      businessId: reservation.businessId,
      productId: variant.productId,
      variantId: variant.id,
      actorId,
      type: "RELEASE",
      quantity: 0,
      reservedDelta: -reservation.quantity,
      reservedAfter: variant.reserved,
      balanceAfter: variant.stock,
      note: `${status}: ${reservation.buyerName} · ${reservation.note}`,
      reference: reservation.id,
    },
  });
  await audit(
    tx,
    actorId,
    reservation.businessId,
    `RESERVATION_${status}`,
    id,
    `${reservation.quantity} units · ${reservation.buyerName}`,
  );
  return { ...reservation, status };
}
@Injectable()
export class ReservationService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(@Inject(Database) private readonly db: Database) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.expire().catch(() =>
        Logger.error("Reservation expiry failed", "Reservations"),
      );
    }, 30000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async expire(businessId?: string) {
    if (this.busy) return;
    this.busy = true;
    try {
      const expired = await this.db.stockReservation.findMany({
        where: {
          ...(businessId ? { businessId } : {}),
          status: "ACTIVE",
          expiresAt: { lte: new Date() },
        },
        take: 100,
      });
      for (const r of expired)
        await this.db.serial(async (tx) => {
          await releaseReservation(tx, r.id, r.actorId, "EXPIRED");
        });
    } finally {
      this.busy = false;
    }
  }
  async list(actor: SessionUser, buyerPhone?: string) {
    return this.db.stockReservation.findMany({
      where: {
        businessId: actor.businessId!,
        ...(buyerPhone ? { buyerPhone } : {}),
      },
      include: {
        variant: {
          select: {
            size: true,
            color: true,
            product: { select: { name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
  async create(actor: SessionUser, body: unknown) {
    const input = parse(reserveSchema, body);
    const requestHash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    return this.db.serial(async (tx) => {
      const old = await tx.stockReservation.findUnique({
        where: {
          businessId_requestKey: {
            businessId: actor.businessId!,
            requestKey: input.requestKey,
          },
        },
      });
      if (old) {
        if (old.requestHash !== requestHash)
          throw new BadRequestException(
            "Reservation request key already used with different details",
          );
        return old;
      }
      activeBusiness(
        await tx.business.findUniqueOrThrow({
          where: { id: actor.businessId! },
        }),
      );
      const variant = await tx.variant.findFirst({
        where: {
          id: input.variantId,
          businessId: actor.businessId!,
          archived: false,
          product: { moderation: { not: "ARCHIVED" } },
        },
      });
      if (!variant) throw new NotFoundException("Variant not found");
      if (variant.stock - variant.reserved < input.quantity)
        throw new BadRequestException(
          `Only ${variant.stock - variant.reserved} unreserved units are available`,
        );
      const updated = await tx.variant.update({
        where: { id: variant.id },
        data: { reserved: { increment: input.quantity } },
      });
      const { hours, ...data } = input;
      const reservation = await tx.stockReservation.create({
        data: {
          ...data,
          requestHash,
          businessId: actor.businessId!,
          actorId: actor.id,
          expiresAt: new Date(Date.now() + hours * 3600000),
        },
      });
      await tx.stockMovement.create({
        data: {
          businessId: actor.businessId!,
          productId: variant.productId,
          variantId: variant.id,
          actorId: actor.id,
          type: "RESERVATION",
          quantity: 0,
          reservedDelta: input.quantity,
          reservedAfter: updated.reserved,
          balanceAfter: updated.stock,
          note: `${input.buyerName} · ${input.note}`,
          reference: reservation.id,
        },
      });
      await audit(
        tx,
        actor.id,
        actor.businessId,
        "STOCK_RESERVED",
        reservation.id,
        `${input.quantity} units · ${input.buyerName}`,
      );
      if (
        updated.stock - updated.reserved <= variant.lowStockAt &&
        variant.stock - variant.reserved > variant.lowStockAt
      )
        await notify(
          tx,
          actor.businessId,
          null,
          updated.stock - updated.reserved === 0 ? "Stock out" : "Low stock",
          `${input.quantity} units held; ${updated.stock - updated.reserved} units remain available.`,
          "/dashboard/inventory",
        );
      return reservation;
    });
  }
  async release(actor: SessionUser, id: string) {
    return this.db.serial(async (tx) => {
      const r = await tx.stockReservation.findFirst({
        where: { id, businessId: actor.businessId! },
      });
      if (!r) throw new NotFoundException("Reservation not found");
      return releaseReservation(tx, id, actor.id, "RELEASED");
    });
  }
}
@Controller("v1/inventory/reservations")
@UseGuards(SessionGuard)
export class ReservationController {
  constructor(
    @Inject(ReservationService) private readonly service: ReservationService,
  ) {}
  @Get() @Ability("INVENTORY", "VIEW") list(@Req() req: AuthRequest) {
    return this.service.list(req.actor);
  }
  @Post() @Ability("INVENTORY", "EDIT") reserve(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.create(req.actor, body);
  }
  @Post(":id/release") @Ability("INVENTORY", "VIEW") release(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    if (!req.actor.permissions.includes("INVENTORY:EDIT"))
      throw new BadRequestException("Inventory edit permission is required");
    return this.service.release(req.actor, id);
  }
}
@Module({
  imports: [AuthModule],
  providers: [ReservationService],
  controllers: [ReservationController],
})
export class ReservationModule {}
