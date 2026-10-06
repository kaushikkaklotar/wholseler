import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Injectable,
  Module,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { SessionUser } from "@wholesale/shared";
import { Ability, AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { activeBusiness } from "./business-policy";
import { Database, audit, notify } from "./database";
import { parse } from "./validation";
const rowSchema = z.object({
  sku: z.string().trim().toUpperCase().min(2).max(40),
  size: z.string().trim().max(40).default("Free size"),
  color: z.string().trim().max(40).default("Mixed"),
  quantity: z
    .number()
    .int()
    .min(-1000000)
    .max(1000000)
    .refine((n) => n !== 0),
});
const importSchema = z.object({
  requestKey: z.string().uuid(),
  type: z.enum(["PURCHASE", "ADJUSTMENT", "STOCK_OUT"]),
  note: z.string().trim().min(3).max(500),
  rows: z.array(rowSchema).min(1).max(500),
});
type StockInput = z.infer<typeof importSchema>;
const key = (v: { sku: string; size: string; color: string }) =>
  `${v.sku}|${v.size}|${v.color}`.toLowerCase();
@Injectable()
export class StockImportService {
  constructor(@Inject(Database) private readonly db: Database) {}
  private async review(
    tx: Prisma.TransactionClient | Database,
    actor: SessionUser,
    input: StockInput,
  ) {
    const business = await tx.business.findUniqueOrThrow({
      where: { id: actor.businessId! },
      include: { plan: true },
    });
    activeBusiness(business);
    if (!business.plan.bulkImport)
      throw new BadRequestException("Bulk stock upload requires Growth or Pro");
    const variants = await tx.variant.findMany({
      where: {
        businessId: business.id,
        archived: false,
        product: {
          sku: { in: input.rows.map((r) => r.sku) },
          moderation: { not: "ARCHIVED" },
        },
      },
      include: { product: { select: { name: true, sku: true } } },
    });
    const byKey = new Map(
      variants.map((v) => [key({ ...v, sku: v.product.sku }), v]),
    );
    const seen = new Set<string>();
    const errors: string[] = [];
    const rows = input.rows.flatMap((r, index) => {
      const id = key(r),
        v = byKey.get(id);
      let issue = seen.has(id)
        ? "Duplicate variant row"
        : !v
          ? "SKU / size / colour not found in your active catalog"
          : input.type === "PURCHASE" && r.quantity < 0
            ? "Purchase quantity must be positive"
            : input.type === "STOCK_OUT" && r.quantity > 0
              ? "Stock-out quantity must be negative"
              : v.stock + r.quantity < v.reserved
                ? "Result would use reserved stock or become negative"
                : v.stock + r.quantity > 1000000
                  ? "Result exceeds 1,000,000 units"
                  : "";
      seen.add(id);
      if (issue) {
        errors.push(`Row ${index + 2} (${r.sku}): ${issue}`);
        return [];
      }
      return [
        {
          ...r,
          variantId: v!.id,
          productId: v!.productId,
          name: v!.product.name,
          before: v!.stock,
          after: v!.stock + r.quantity,
          reserved: v!.reserved,
          lowStockAt: v!.lowStockAt,
        },
      ];
    });
    return { rows, errors };
  }
  preview(actor: SessionUser, body: unknown) {
    return this.review(this.db, actor, parse(importSchema, body));
  }
  async commit(actor: SessionUser, body: unknown) {
    const input = parse(importSchema, body);
    const hash = createHash("sha256")
      .update(JSON.stringify({ ...input, requestKey: undefined }))
      .digest("hex");
    return this.db.serial(async (tx) => {
      await tx.business.update({
        where: { id: actor.businessId! },
        data: { revision: { increment: 1 } },
      });
      const old = await tx.importBatch.findUnique({
        where: {
          businessId_requestKey: {
            businessId: actor.businessId!,
            requestKey: input.requestKey,
          },
        },
      });
      if (old) {
        if (old.kind !== "STOCK" || old.requestHash !== hash)
          throw new BadRequestException(
            "Import request key already used with different data",
          );
        return { updated: old.count };
      }
      const result = await this.review(tx, actor, input);
      if (result.errors.length)
        throw new BadRequestException(result.errors.slice(0, 20).join("; "));
      const batch = await tx.importBatch.create({
        data: {
          businessId: actor.businessId!,
          kind: "STOCK",
          requestKey: input.requestKey,
          requestHash: hash,
          count: result.rows.length,
        },
      });
      for (const row of result.rows) {
        await tx.variant.update({
          where: { id: row.variantId },
          data: { stock: { increment: row.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            businessId: actor.businessId!,
            productId: row.productId,
            variantId: row.variantId,
            actorId: actor.id,
            type: input.type,
            quantity: row.quantity,
            balanceAfter: row.after,
            reservedAfter: row.reserved,
            note: input.note,
            reference: batch.id,
          },
        });
        if (
          row.after - row.reserved <= row.lowStockAt &&
          row.before - row.reserved > row.lowStockAt
        )
          await notify(
            tx,
            actor.businessId,
            null,
            "Low stock",
            `${row.name}: ${row.after - row.reserved} available units left`,
            "/dashboard/inventory",
          );
      }
      await audit(
        tx,
        actor.id,
        actor.businessId,
        "STOCK_IMPORTED",
        batch.id,
        `${result.rows.length} variants · ${input.type} · ${input.note}`,
      );
      return { updated: result.rows.length };
    });
  }
}
@Controller("v1/inventory/import")
@UseGuards(SessionGuard)
export class StockImportController {
  constructor(
    @Inject(StockImportService) private readonly service: StockImportService,
  ) {}
  @Post("preview") @Ability("INVENTORY", "EDIT") preview(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.preview(req.actor, body);
  }
  @Post() @Ability("INVENTORY", "EDIT") commit(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.commit(req.actor, body);
  }
}
@Module({
  imports: [AuthModule],
  providers: [StockImportService],
  controllers: [StockImportController],
})
export class StockImportModule {}
