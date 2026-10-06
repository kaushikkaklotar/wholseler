import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { paymentState, type SessionUser } from "@wholesale/shared";
import type { Response } from "express";
import { Ability, AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { Database } from "./database";
import { csv, invoiceOutput } from "./billing";
export const dateKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
const startOfDay = (d: Date) => new Date(`${dateKey(d)}T00:00:00+05:30`);
@Injectable()
export class ReportingService {
  constructor(@Inject(Database) private readonly db: Database) {}
  async dashboard(actor: SessionUser) {
    const today = startOfDay(new Date()),
      yesterday = new Date(today.getTime() - 86400000),
      week = new Date(today.getTime() - 6 * 86400000);
    const ownOnly =
      actor.role === "WHOLESALER_STAFF" &&
      !actor.permissions.includes("REPORTS:VIEW");
    const [invoices, variants, inquiries, productCount, business] =
      await Promise.all([
        this.db.invoice.findMany({
          where: {
            businessId: actor.businessId!,
            ...(ownOnly ? { actorId: actor.id } : {}),
          },
          include: { actor: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        }),
        this.db.variant.findMany({
          where: {
            businessId: actor.businessId!,
            archived: false,
            product: { moderation: { not: "ARCHIVED" } },
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                pricePaise: true,
                images: { take: 1, select: { id: true } },
              },
            },
          },
        }),
        this.db.inquiry.findMany({
          where: { businessId: actor.businessId!, status: "NEW" },
          include: {
            seller: {
              select: { businessName: true, user: { select: { name: true } } },
            },
            product: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        this.db.product.count({
          where: {
            businessId: actor.businessId!,
            moderation: { not: "ARCHIVED" },
          },
        }),
        this.db.business.findUniqueOrThrow({
          where: { id: actor.businessId! },
        }),
      ]);
    const outputs = invoices.map(invoiceOutput);
    const sales = (from: Date, to?: Date) =>
      outputs
        .filter((i) => i.createdAt >= from && (!to || i.createdAt < to))
        .reduce((s, i) => s + i.netPaise, 0);
    const daily = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(week.getTime() + i * 86400000);
      return {
        date: dateKey(day),
        salesPaise: sales(day, new Date(day.getTime() + 86400000)),
        invoiceCount: invoices.filter(
          (v) =>
            v.createdAt >= day &&
            v.createdAt < new Date(day.getTime() + 86400000) &&
            v.status !== "CANCELLED",
        ).length,
      };
    });
    return {
      sampleWorkspace: business.isSample,
      ownOnly,
      todaySalesPaise: sales(today),
      yesterdaySalesPaise: sales(yesterday, today),
      todayInvoices: invoices.filter(
        (i) => i.createdAt >= today && i.status !== "CANCELLED",
      ).length,
      outstandingPaise: outputs.reduce((s, i) => s + i.duePaise, 0),
      productCount,
      stockUnits: variants.reduce((s, v) => s + v.stock - v.reserved, 0),
      lowStockCount: variants.filter(
        (v) => v.stock - v.reserved <= v.lowStockAt,
      ).length,
      daily,
      recentInvoices: actor.permissions.includes("BILLING:VIEW")
        ? outputs.slice(0, 5)
        : [],
      lowStock: actor.permissions.includes("INVENTORY:VIEW")
        ? variants
            .filter((v) => v.stock - v.reserved <= v.lowStockAt)
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 5)
        : [],
      inquiries: actor.permissions.includes("SELLERS:VIEW") ? inquiries : [],
    };
  }
  async reports(actor: SessionUser, days = 30, month?: string) {
    if (!month && days > 30 && !actor.plan?.advancedReports)
      throw new BadRequestException(
        "Extended report periods require Growth or Pro",
      );
    let from = new Date(
        startOfDay(new Date()).getTime() - (days - 1) * 86400000,
      ),
      end = new Date(startOfDay(new Date()).getTime() + 86400000);
    if (month) {
      if (!/^[12]\d{3}-(0[1-9]|1[0-2])$/.test(month))
        throw new BadRequestException("Enter a valid report month");
      const [y, m] = month.split("-").map(Number);
      from = new Date(`${month}-01T00:00:00+05:30`);
      end = new Date(Math.min(Date.UTC(y, m, 1) - 19800000, end.getTime()));
      if (from >= end)
        throw new BadRequestException(
          "Choose the current month or an earlier month",
        );
      days = Math.ceil((end.getTime() - from.getTime()) / 86400000);
    }
    const [invoices, movements, inquiries, variants] = await Promise.all([
      this.db.invoice.findMany({
        where: {
          businessId: actor.businessId!,
          createdAt: { gte: from, lt: end },
        },
        include: { items: true, actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      this.db.stockMovement.findMany({
        where: {
          businessId: actor.businessId!,
          createdAt: { gte: from, lt: end },
        },
        select: { type: true, quantity: true, createdAt: true },
      }),
      this.db.inquiry.count({
        where: {
          businessId: actor.businessId!,
          createdAt: { gte: from, lt: end },
        },
      }),
      this.db.variant.findMany({
        where: {
          businessId: actor.businessId!,
          archived: false,
          product: { moderation: { not: "ARCHIVED" } },
        },
        include: {
          product: { select: { name: true, sku: true, pricePaise: true } },
        },
      }),
    ]);
    const products = new Map<
        string,
        { name: string; sku: string; units: number; salesPaise: number }
      >(),
      staff = new Map<
        string,
        { name: string; invoices: number; salesPaise: number }
      >();
    const outputs = invoices.map(invoiceOutput);
    for (const invoice of outputs) {
      if (invoice.status === "CANCELLED") continue;
      const current = staff.get(invoice.actor.id) || {
        name: invoice.actor.name,
        invoices: 0,
        salesPaise: 0,
      };
      current.invoices++;
      current.salesPaise += invoice.netPaise;
      staff.set(invoice.actor.id, current);
      for (const item of invoice.items) {
        const p = products.get(item.productId) || {
          name: item.productName,
          sku: item.sku,
          units: 0,
          salesPaise: 0,
        };
        p.units += item.quantity - item.returnedQuantity;
        p.salesPaise +=
          item.lineTotalPaise -
          Math.floor(
            (item.lineTotalPaise * item.returnedQuantity) / item.quantity,
          );
        products.set(item.productId, p);
      }
    }
    const daily = Array.from({ length: days }, (_, i) => {
      const day = dateKey(new Date(from.getTime() + i * 86400000));
      const batch = outputs.filter((v) => dateKey(v.createdAt) === day);
      return {
        date: day,
        salesPaise: batch.reduce((s, v) => s + v.netPaise, 0),
        invoiceCount: batch.filter((v) => v.status !== "CANCELLED").length,
      };
    });
    const movementTypes = [...new Set(movements.map((m) => m.type))].map(
      (type) => ({
        type,
        quantity: movements
          .filter((m) => m.type === type)
          .reduce((s, m) => s + m.quantity, 0),
        count: movements.filter((m) => m.type === type).length,
      }),
    );
    return {
      days,
      from: dateKey(from),
      to: dateKey(new Date(end.getTime() - 1)),
      salesPaise: outputs.reduce((s, i) => s + i.netPaise, 0),
      collectedPaise: outputs.reduce((s, i) => s + i.paidPaise, 0),
      returnsPaise: outputs.reduce((s, i) => s + i.returnedPaise, 0),
      outstandingPaise: outputs.reduce((s, i) => s + i.duePaise, 0),
      invoiceCount: outputs.filter((i) => i.status !== "CANCELLED").length,
      inquiryCount: inquiries,
      stockUnits: variants.reduce((s, v) => s + v.stock - v.reserved, 0),
      stockValuePaise: variants.reduce(
        (s, v) => s + v.stock * v.product.pricePaise,
        0,
      ),
      lowStockCount: variants.filter(
        (v) => v.stock - v.reserved <= v.lowStockAt,
      ).length,
      topProducts: [...products.values()]
        .sort((a, b) => b.salesPaise - a.salesPaise)
        .slice(0, 10),
      staff: [...staff.values()].sort((a, b) => b.salesPaise - a.salesPaise),
      daily,
      movementTypes,
    };
  }
}
@Controller("v1/dashboard")
@UseGuards(SessionGuard)
export class DashboardController {
  constructor(
    @Inject(ReportingService) private readonly reporting: ReportingService,
  ) {}
  @Get() @Ability("DASHBOARD", "VIEW") get(@Req() req: AuthRequest) {
    return this.reporting.dashboard(req.actor);
  }
}
@Controller("v1/reports")
@UseGuards(SessionGuard)
export class ReportsController {
  constructor(
    @Inject(ReportingService) private readonly reporting: ReportingService,
  ) {}
  @Get() @Ability("REPORTS", "VIEW") get(
    @Req() req: AuthRequest,
    @Query("days") days?: string,
    @Query("month") month?: string,
  ) {
    return this.reporting.reports(
      req.actor,
      [7, 30, 90, 365].includes(Number(days)) ? Number(days) : 30,
      month || undefined,
    );
  }
  @Get("export") @Ability("REPORTS", "VIEW") async export(
    @Req() req: AuthRequest,
    @Query("days") days: string,
    @Query("month") month: string,
    @Res() res: Response,
  ) {
    const report = await this.reporting.reports(
      req.actor,
      [7, 30, 90, 365].includes(Number(days)) ? Number(days) : 30,
      month || undefined,
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="sales-report.csv"',
    );
    res.send(
      csv([
        ["Date", "Net sales INR", "Invoices"],
        ...report.daily.map((d) => [
          d.date,
          d.salesPaise / 100,
          d.invoiceCount,
        ]),
      ]),
    );
  }
}
@Module({
  imports: [AuthModule],
  providers: [ReportingService],
  controllers: [DashboardController, ReportsController],
})
export class ReportingModule {}
