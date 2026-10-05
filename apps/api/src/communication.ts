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
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { SessionUser } from "@wholesale/shared";
import { AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { Database, audit, notify } from "./database";
import { parse } from "./validation";
const isPlatform = (actor: SessionUser) =>
  ["PLATFORM_ADMIN", "PLATFORM_OPERATIONS"].includes(actor.role);
@Injectable()
export class CommunicationService {
  constructor(@Inject(Database) private readonly db: Database) {}
  private notificationScope(actor: SessionUser): Prisma.NotificationWhereInput {
    const businessScope: Prisma.NotificationWhereInput[] = [];
    if (actor.businessId && actor.role === "WHOLESALER_OWNER")
      businessScope.push({ businessId: actor.businessId, userId: null });
    if (actor.businessId && actor.role === "WHOLESALER_STAFF") {
      const hrefs: string[] = [];
      if (actor.permissions.includes("INVENTORY:VIEW"))
        hrefs.push("/dashboard/inventory");
      if (actor.permissions.includes("PRODUCTS:VIEW"))
        hrefs.push("/dashboard/products");
      if (actor.permissions.includes("SELLERS:VIEW"))
        hrefs.push("/dashboard/buyers");
      if (actor.permissions.includes("SETTINGS:VIEW"))
        hrefs.push("/dashboard/settings");
      if (hrefs.length)
        businessScope.push({
          businessId: actor.businessId,
          userId: null,
          href: { in: hrefs },
        });
    }
    return {
      OR: [{ userId: actor.id }, ...businessScope],
    };
  }
  async notifications(actor: SessionUser) {
    const records = await this.db.notification.findMany({
      where: this.notificationScope(actor),
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return {
      notifications: records.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        href: n.href,
        createdAt: n.createdAt,
        read: n.readBy.includes(actor.id),
      })),
      unread: records.filter((n) => !n.readBy.includes(actor.id)).length,
    };
  }
  async markRead(actor: SessionUser, id: string) {
    const changed = await this.db.notification.updateMany({
      where: {
        id,
        ...this.notificationScope(actor),
        NOT: { readBy: { has: actor.id } },
      },
      data: { readBy: { push: actor.id } },
    });
    return { ok: true, changed: changed.count };
  }
  private ticketScope(actor: SessionUser): Prisma.SupportTicketWhereInput {
    return isPlatform(actor)
      ? {}
      : {
          OR: [
            { userId: actor.id },
            ...(actor.businessId && actor.role === "WHOLESALER_OWNER"
              ? [{ businessId: actor.businessId }]
              : []),
          ],
        };
  }
  async tickets(actor: SessionUser) {
    return this.db.supportTicket.findMany({
      where: this.ticketScope(actor),
      include: {
        user: { select: { name: true, phone: true } },
        business: { select: { name: true } },
        messages: {
          include: { user: { select: { name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }
  async create(actor: SessionUser, body: unknown) {
    const input = parse(
      z.object({
        subject: z.string().trim().min(3).max(150),
        category: z.enum([
          "CATALOG",
          "BILLING",
          "ACCOUNT",
          "SUBSCRIPTION",
          "OTHER",
        ]),
        message: z.string().trim().min(5).max(2000),
      }),
      body,
    );
    if (isPlatform(actor))
      throw new BadRequestException(
        "Create a support request from a business or seller account",
      );
    return this.db.serial(async (tx) => {
      const ticket = await tx.supportTicket.create({
        data: {
          businessId: actor.businessId,
          userId: actor.id,
          subject: input.subject,
          category: input.category,
          messages: { create: { userId: actor.id, text: input.message } },
        },
      });
      await audit(
        tx,
        actor.id,
        actor.businessId,
        "SUPPORT_OPENED",
        ticket.id,
        input.subject,
      );
      return ticket;
    });
  }
  async reply(actor: SessionUser, id: string, body: unknown) {
    const input = parse(
      z.object({
        message: z.string().trim().min(1).max(2000),
        status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
      }),
      body,
    );
    if (input.status && !isPlatform(actor))
      throw new BadRequestException(
        "Only the platform team can change ticket status",
      );
    return this.db.serial(async (tx) => {
      const ticket = await tx.supportTicket.findFirst({
        where: { id, ...this.ticketScope(actor) },
      });
      if (!ticket) throw new NotFoundException("Ticket not found");
      await tx.ticketMessage.create({
        data: { ticketId: id, userId: actor.id, text: input.message },
      });
      await tx.supportTicket.update({
        where: { id },
        data: {
          updatedAt: new Date(),
          ...(input.status ? { status: input.status } : {}),
        },
      });
      if (isPlatform(actor))
        await notify(
          tx,
          ticket.businessId,
          ticket.userId,
          "Support reply",
          ticket.subject,
          "/support",
        );
      await audit(
        tx,
        actor.id,
        ticket.businessId,
        "SUPPORT_REPLIED",
        id,
        input.status || "Reply added",
      );
      return { ok: true };
    });
  }
}
@Controller("v1/notifications")
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(
    @Inject(CommunicationService)
    private readonly service: CommunicationService,
  ) {}
  @Get() get(@Req() req: AuthRequest) {
    return this.service.notifications(req.actor);
  }
  @Patch(":id/read") read(@Req() req: AuthRequest, @Param("id") id: string) {
    return this.service.markRead(req.actor, id);
  }
}
@Controller("v1/support")
@UseGuards(SessionGuard)
export class SupportController {
  constructor(
    @Inject(CommunicationService)
    private readonly service: CommunicationService,
  ) {}
  @Get() get(@Req() req: AuthRequest) {
    return this.service.tickets(req.actor);
  }
  @Post() create(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.service.create(req.actor, body);
  }
  @Post(":id/replies") reply(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.reply(req.actor, id, body);
  }
}
@Module({
  imports: [AuthModule],
  providers: [CommunicationService],
  controllers: [NotificationsController, SupportController],
})
export class CommunicationModule {}
