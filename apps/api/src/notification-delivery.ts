import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { NotificationDelivery } from "@prisma/client";
import { z } from "zod";
import { money, paymentState, type SessionUser } from "@wholesale/shared";
import { Ability, AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { Database, audit } from "./database";
import { queueDelivery, type DeliveryTopic } from "./delivery-queue";
import { parse } from "./validation";
const preferenceSchema = z
  .object({
    sms: z.boolean(),
    whatsapp: z.boolean(),
    email: z.boolean(),
    emailAddress: z
      .string()
      .trim()
      .max(200)
      .refine(
        (s) => !s || z.email().safeParse(s).success,
        "Enter a valid email address",
      ),
    newArrivals: z.boolean(),
    stockAlerts: z.boolean(),
    inquiryAlerts: z.boolean(),
    paymentReminders: z.boolean(),
  })
  .refine(
    (p) => !p.email || !!p.emailAddress,
    "Enter an email address to receive email alerts",
  );
const topicEnv = (topic: string) =>
  topic.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
export function deliveryConfigured(channel: string, topic: string) {
  if (process.env.NOTIFICATION_MODE !== "live") return false;
  if (channel === "EMAIL")
    return !!(
      process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL_FROM
    );
  if (channel === "SMS")
    return !!(
      process.env.MSG91_AUTH_KEY &&
      process.env[`SMS_FLOW_${topicEnv(topic)}`] &&
      process.env.SMS_SENDER_ID
    );
  return !!(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_API_VERSION &&
    process.env[`WHATSAPP_TEMPLATE_${topicEnv(topic)}`]
  );
}
class ProviderError extends Error {
  constructor(
    public retry: boolean,
    message: string,
  ) {
    super(message);
  }
}
export async function sendDelivery(delivery: NotificationDelivery) {
  const href = new URL(delivery.href, process.env.WEB_ORIGIN).toString();
  let url: string, headers: Record<string, string>, payload: unknown;
  if (delivery.channel === "EMAIL") {
    url = "https://api.resend.com/emails";
    headers = {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Idempotency-Key": delivery.id,
    };
    payload = {
      from: process.env.NOTIFICATION_EMAIL_FROM,
      to: [delivery.recipient],
      subject: delivery.title,
      text: `${delivery.body}\n\n${href}\n\nManage alerts in your account's Notifications settings.`,
    };
  } else if (delivery.channel === "SMS") {
    url = "https://api.msg91.com/api/v5/flow/";
    headers = { authkey: process.env.MSG91_AUTH_KEY! };
    payload = {
      flow_id: process.env[`SMS_FLOW_${topicEnv(delivery.topic)}`],
      sender: process.env.SMS_SENDER_ID,
      recipients: [
        {
          mobiles: delivery.recipient,
          TITLE: delivery.title,
          MESSAGE: delivery.body,
          LINK: href,
        },
      ],
    };
  } else {
    if (
      !/^v\d+\.\d+$/.test(process.env.WHATSAPP_API_VERSION || "") ||
      !/^\d+$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID || "")
    )
      throw new ProviderError(
        false,
        "WhatsApp API version or sender configuration is invalid",
      );
    url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    headers = { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` };
    payload = {
      messaging_product: "whatsapp",
      to: delivery.recipient,
      type: "template",
      template: {
        name: process.env[`WHATSAPP_TEMPLATE_${topicEnv(delivery.topic)}`],
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en" },
        components: [
          {
            type: "body",
            parameters: [delivery.title, delivery.body, href].map((text) => ({
              type: "text",
              text,
            })),
          },
        ],
      },
    };
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new ProviderError(
      response.status === 429 || response.status >= 500,
      `Provider rejected the request (HTTP ${response.status})`,
    );
  const result = (await response.json()) as {
    type?: string;
    id?: string;
    messages?: { id: string }[];
  };
  if (delivery.channel === "SMS" && result.type !== "success")
    throw new ProviderError(
      false,
      "SMS provider rejected the template or recipient; review its dashboard",
    );
  if (
    (delivery.channel === "EMAIL" && !result.id) ||
    (delivery.channel === "WHATSAPP" && !result.messages?.length)
  )
    throw new ProviderError(
      false,
      "Provider did not acknowledge the message; review its dashboard",
    );
}
@Injectable()
export class DeliveryService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(@Inject(Database) private readonly db: Database) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.process().catch(() =>
        Logger.error("Notification queue processing failed", "Notifications"),
      );
    }, 15000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async settings(actor: SessionUser) {
    const [preference, deliveries] = await Promise.all([
      this.db.notificationPreference.findUnique({
        where: { userId: actor.id },
      }),
      this.db.notificationDelivery.findMany({
        where: { userId: actor.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          channel: true,
          title: true,
          status: true,
          lastError: true,
          createdAt: true,
          attempts: true,
        },
      }),
    ]);
    return {
      preference: preference || {
        sms: false,
        whatsapp: false,
        email: false,
        emailAddress: "",
        newArrivals: false,
        stockAlerts: false,
        inquiryAlerts: false,
        paymentReminders: false,
      },
      deliveries,
      providers: {
        mode: process.env.NOTIFICATION_MODE === "live" ? "live" : "local",
        email: deliveryConfigured("EMAIL", "stockAlerts"),
        sms: [
          "newArrivals",
          "stockAlerts",
          "inquiryAlerts",
          "paymentReminders",
        ].every((t) => deliveryConfigured("SMS", t)),
        whatsapp: [
          "newArrivals",
          "stockAlerts",
          "inquiryAlerts",
          "paymentReminders",
        ].every((t) => deliveryConfigured("WHATSAPP", t)),
      },
    };
  }
  async save(actor: SessionUser, body: unknown) {
    const input = parse(preferenceSchema, body);
    const preference = await this.db.notificationPreference.upsert({
      where: { userId: actor.id },
      create: { ...input, userId: actor.id },
      update: input,
    });
    return { preference };
  }
  async reminder(actor: SessionUser, invoiceId: string) {
    return this.db.serial(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: {
          id: invoiceId,
          businessId: actor.businessId!,
          status: "ISSUED",
        },
        include: { business: { select: { name: true } } },
      });
      if (!invoice) throw new BadRequestException("Active invoice not found");
      const due = paymentState(
        invoice.totalPaise,
        invoice.returnedPaise,
        invoice.paidPaise,
      ).duePaise;
      if (!due)
        throw new BadRequestException("This invoice has no outstanding amount");
      const buyer = await tx.user.findFirst({
        where: { phone: invoice.buyerPhone, role: "SELLER", disabled: false },
        include: { notificationPreference: true },
      });
      const p = buyer?.notificationPreference;
      if (
        !buyer ||
        !p?.paymentReminders ||
        !(p.sms || p.whatsapp || (p.email && p.emailAddress))
      )
        throw new BadRequestException(
          "Buyer must have a registered account and opt in to payment reminders before delivery can be queued",
        );
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
      }).format(new Date());
      await queueDelivery(tx, {
        businessId: invoice.businessId,
        userId: buyer.id,
        topic: "paymentReminders",
        key: `invoice:${invoice.id}:${day}`,
        title: `Payment reminder · ${invoice.number}`,
        body: `${invoice.business.name}: ${money(due)} remains against invoice ${invoice.number}. Contact the supplier to arrange payment.`,
        href: "/seller/inquiries",
      });
      await audit(
        tx,
        actor.id,
        actor.businessId,
        "PAYMENT_REMINDER_QUEUED",
        invoice.id,
        "Opt-in buyer reminder; limited to one per channel per day",
      );
      return { ok: true };
    });
  }
  async process(sender = sendDelivery, scopeUserId?: string) {
    if (this.busy) return;
    this.busy = true;
    try {
      // A crash after an external request may have sent a message. Never blindly resend it.
      await this.db.notificationDelivery.updateMany({
        where: {
          ...(scopeUserId ? { userId: scopeUserId } : {}),
          status: "SENDING",
          claimedAt: { lt: new Date(Date.now() - 60000) },
        },
        data: {
          status: "UNKNOWN",
          lastError:
            "Delivery outcome is unknown. Check the provider before retrying.",
        },
      });
      const due = await this.db.notificationDelivery.findMany({
        where: {
          ...(scopeUserId ? { userId: scopeUserId } : {}),
          status: { in: ["QUEUED", "NOT_CONFIGURED", "RETRY"] },
          nextAttemptAt: { lte: new Date() },
        },
        take: 20,
        orderBy: { createdAt: "asc" },
      });
      for (const delivery of due) {
        const user = await this.db.user.findUnique({
          where: { id: delivery.userId },
          include: {
            notificationPreference: true,
            staff: true,
            business: true,
            seller: true,
          },
        });
        const pref = user?.notificationPreference;
        const channelAllowed =
          delivery.channel === "EMAIL"
            ? pref?.email && pref.emailAddress === delivery.recipient
            : delivery.recipient === `91${user?.phone}` &&
              (delivery.channel === "SMS" ? pref?.sms : pref?.whatsapp);
        const topic = delivery.topic as DeliveryTopic;
        const staffPermission =
          topic === "stockAlerts" ? "INVENTORY:VIEW" : "SELLERS:VIEW";
        const following =
          topic !== "newArrivals" ||
          !!(
            user?.seller &&
            delivery.businessId &&
            (await this.db.supplierFavorite.findUnique({
              where: {
                businessId_sellerId: {
                  businessId: delivery.businessId,
                  sellerId: user.seller.id,
                },
              },
            }))
          );
        if (
          !following ||
          !user ||
          user.disabled ||
          !pref ||
          !pref[topic] ||
          !channelAllowed ||
          user.business?.verificationStatus === "SUSPENDED" ||
          user.seller?.verificationStatus === "SUSPENDED" ||
          (user.role === "WHOLESALER_STAFF" &&
            (!user.staff?.active ||
              !user.staff.permissions.includes(staffPermission)))
        ) {
          await this.db.notificationDelivery.updateMany({
            where: { id: delivery.id, status: delivery.status },
            data: {
              status: "CANCELLED",
              lastError:
                "Recipient preferences or access no longer allow this alert",
            },
          });
          continue;
        }
        if (!deliveryConfigured(delivery.channel, delivery.topic)) {
          await this.db.notificationDelivery.updateMany({
            where: { id: delivery.id, status: delivery.status },
            data: {
              status: "NOT_CONFIGURED",
              nextAttemptAt: new Date(Date.now() + 60000),
              lastError: "Live provider / approved template is not configured",
            },
          });
          continue;
        }
        const claimed = await this.db.notificationDelivery.updateMany({
          where: { id: delivery.id, status: delivery.status },
          data: {
            status: "SENDING",
            claimedAt: new Date(),
            attempts: { increment: 1 },
          },
        });
        if (!claimed.count) continue;
        try {
          await sender(delivery);
          await this.db.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "ACCEPTED",
              deliveredAt: new Date(),
              lastError: "",
            },
          });
        } catch (e) {
          const known = e instanceof ProviderError;
          const retry = known && e.retry && delivery.attempts < 2;
          await this.db.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: retry ? "RETRY" : known ? "FAILED" : "UNKNOWN",
              nextAttemptAt: new Date(
                Date.now() + 60000 * 2 ** delivery.attempts,
              ),
              lastError: known
                ? e.message
                : "Request outcome is unknown. Check the provider before retrying.",
            },
          });
        }
      }
    } finally {
      this.busy = false;
    }
  }
}
@Controller("v1/notification-settings")
@UseGuards(SessionGuard)
export class DeliveryController {
  constructor(
    @Inject(DeliveryService) private readonly service: DeliveryService,
  ) {}
  @Get() get(@Req() req: AuthRequest) {
    return this.service.settings(req.actor);
  }
  @Patch() save(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.service.save(req.actor, body);
  }
}
@Controller("v1/billing/invoices/:id/reminder")
@UseGuards(SessionGuard)
export class ReminderController {
  constructor(
    @Inject(DeliveryService) private readonly service: DeliveryService,
  ) {}
  @Post() @Ability("BILLING", "EDIT") reminder(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.service.reminder(req.actor, id);
  }
}
@Module({
  imports: [AuthModule],
  providers: [DeliveryService],
  controllers: [DeliveryController, ReminderController],
})
export class DeliveryModule {}
