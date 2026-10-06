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
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  inquirySchema,
  paymentState,
  sellerSchema,
  type SessionUser,
} from "@wholesale/shared";
import {
  Ability,
  AllowRoles,
  AuthModule,
  type AuthRequest,
  SessionGuard,
} from "./auth";
import { Database, audit, notify } from "./database";
import { parse } from "./validation";
const publicInclude = {
  business: {
    select: {
      id: true,
      name: true,
      city: true,
      marketArea: true,
      phone: true,
      address: true,
      categories: true,
      moq: true,
      deliveryInfo: true,
      description: true,
      verificationStatus: true,
      contactPreference: true,
    },
  },
  variants: {
    where: { archived: false },
    select: { id: true, size: true, color: true, stock: true, reserved: true },
  },
  images: { select: { id: true } },
} satisfies Prisma.ProductInclude;
type PublicProduct = Prisma.ProductGetPayload<{
  include: typeof publicInclude;
}>;
@Injectable()
export class SourcingService {
  constructor(@Inject(Database) private readonly db: Database) {}
  private serialize(
    p: PublicProduct,
    approved: Set<string>,
    favorites: Set<string>,
  ) {
    const show =
      p.visibility === "PUBLIC" ||
      (p.visibility === "APPROVED_SELLERS" && approved.has(p.businessId));
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      description: p.description,
      moq: p.moq,
      cartonUnits: p.cartonUnits,
      tags: p.tags,
      createdAt: p.createdAt,
      visibility: p.visibility,
      pricePaise: show ? p.pricePaise : null,
      cartonPricePaise: show ? p.cartonPricePaise : null,
      priceAvailable: show,
      stock: p.variants.reduce((s, v) => s + v.stock - v.reserved, 0),
      variants: p.variants.map(({ reserved, ...v }) => ({
        ...v,
        stock: v.stock - reserved,
      })),
      images: p.images.map((i) => ({ id: i.id, url: `/api/v1/media/${i.id}` })),
      business: p.business,
      favorite: favorites.has(p.id),
      activity: p.soldUnits + p.viewCount,
    };
  }
  async discover(
    actor: SessionUser,
    query: Record<string, string | undefined>,
  ) {
    const sellerId = actor.sellerId;
    if (!sellerId)
      throw new BadRequestException("Complete your seller profile first");
    const [access, favorites] = await Promise.all([
      this.db.sellerAccess.findMany({
        where: { sellerId, approved: true },
        select: { businessId: true },
      }),
      this.db.favorite.findMany({
        where: { sellerId },
        select: { productId: true },
      }),
    ]);
    const approved = new Set(access.map((a) => a.businessId)),
      favoriteIds = new Set(favorites.map((f) => f.productId));
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p.moderation='APPROVED'`,
      Prisma.sql`b."verificationStatus"='VERIFIED'`,
    ];
    const canPrice = approved.size
      ? Prisma.sql`(p.visibility='PUBLIC' OR (p.visibility='APPROVED_SELLERS' AND p."businessId" IN (${Prisma.join([...approved])})))`
      : Prisma.sql`p.visibility='PUBLIC'`;
    const q = query.q?.trim().slice(0, 100);
    if (
      query.page !== "2" &&
      (!query.page || query.page === "1") &&
      query.favorites !== "true" &&
      ((q && q.length >= 3) || query.category)
    ) {
      const day = new Date(
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
          new Date(),
        ) + "T00:00:00Z",
      );
      await this.db.searchEvent.createMany({
        data: {
          sellerId,
          query: (q || "").toLowerCase(),
          category: query.category?.slice(0, 80) || "",
          day,
        },
        skipDuplicates: true,
      });
    }
    if (q)
      conditions.push(
        Prisma.sql`(to_tsvector('simple',p.name || ' ' || p.sku || ' ' || p.category || ' ' || b.name || ' ' || b."marketArea") @@ websearch_to_tsquery('simple',${q}) OR p.name ILIKE ${`%${q}%`} OR p.sku ILIKE ${`%${q}%`} OR b.name ILIKE ${`%${q}%`})`,
      );
    if (query.city)
      conditions.push(
        Prisma.sql`b.city ILIKE ${`%${query.city.slice(0, 80)}%`}`,
      );
    if (query.market)
      conditions.push(
        Prisma.sql`b."marketArea" ILIKE ${`%${query.market.slice(0, 100)}%`}`,
      );
    if (query.category)
      conditions.push(Prisma.sql`p.category=${query.category.slice(0, 80)}`);
    if (query.favorites === "true")
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM "Favorite" f WHERE f."productId"=p.id AND f."sellerId"=${sellerId})`,
      );
    if (query.inStock === "true")
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM "Variant" v WHERE v."productId"=p.id AND v.archived=false AND v.stock>v.reserved)`,
      );
    for (const key of ["minPrice", "maxPrice"] as const) {
      if (query[key] !== undefined && query[key] !== "") {
        const price = Number(query[key]);
        if (!Number.isFinite(price) || price < 0 || price > 100000000)
          throw new BadRequestException("Enter a valid price filter");
        conditions.push(
          canPrice,
          key === "minPrice"
            ? Prisma.sql`p."pricePaise">=${Math.round(price * 100)}`
            : Prisma.sql`p."pricePaise"<=${Math.round(price * 100)}`,
        );
      }
    }
    const page = Math.min(
      100000,
      Math.max(1, Math.floor(Number(query.page) || 1)),
    );
    const where = Prisma.join(conditions, " AND ");
    const order =
      query.sort === "trending"
        ? Prisma.sql`(p."soldUnits" * 3 + p."viewCount" + COALESCE((SELECT SUM(GREATEST(sm.quantity,0)) FROM "StockMovement" sm WHERE sm."productId"=p.id AND sm."createdAt">NOW()-INTERVAL '30 days'),0) + (SELECT COUNT(*) FROM "SearchEvent" se WHERE se.category=p.category AND se."createdAt">NOW()-INTERVAL '30 days')) DESC, p."createdAt" DESC, p.id`
        : query.sort === "price"
          ? Prisma.sql`CASE WHEN ${canPrice} THEN p."pricePaise" ELSE NULL END ASC NULLS LAST, p."createdAt" DESC, p.id`
          : Prisma.sql`p."createdAt" DESC, p.id`;
    const [ids, counts, supplierCount] = await Promise.all([
      this.db.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT p.id FROM "Product" p JOIN "Business" b ON p."businessId"=b.id WHERE ${where} ORDER BY ${order} LIMIT 24 OFFSET ${(page - 1) * 24}`,
      ),
      this.db.$queryRaw<{ total: bigint }[]>(
        Prisma.sql`SELECT COUNT(*) AS total FROM "Product" p JOIN "Business" b ON p."businessId"=b.id WHERE ${where}`,
      ),
      this.db.business.count({ where: { verificationStatus: "VERIFIED" } }),
    ]);
    const products = await this.db.product.findMany({
      where: { id: { in: ids.map((p) => p.id) } },
      include: publicInclude,
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    return {
      products: ids.flatMap(({ id }) => {
        const product = byId.get(id);
        return product ? [this.serialize(product, approved, favoriteIds)] : [];
      }),
      total: Number(counts[0].total),
      supplierCount,
      page,
    };
  }

  async one(actor: SessionUser, id: string) {
    const product = await this.db.product.findFirst({
      where: {
        id,
        moderation: "APPROVED",
        business: { verificationStatus: "VERIFIED" },
      },
      include: publicInclude,
    });
    if (!product)
      throw new NotFoundException("Product is not available for sourcing");
    const [access, favorite] = await Promise.all([
      this.db.sellerAccess.findUnique({
        where: {
          businessId_sellerId: {
            businessId: product.businessId,
            sellerId: actor.sellerId!,
          },
        },
      }),
      this.db.favorite.findUnique({
        where: {
          sellerId_productId: { sellerId: actor.sellerId!, productId: id },
        },
      }),
    ]);
    await this.db.serial(async (tx) => {
      const day = new Date(
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()) + "T00:00:00Z",
      );
      const inserted = await tx.productView.createMany({
        data: { productId: id, sellerId: actor.sellerId!, day },
        skipDuplicates: true,
      });
      if (inserted.count)
        await tx.product.update({
          where: { id },
          data: { viewCount: { increment: 1 } },
        });
    });
    return this.serialize(
      product,
      new Set(access?.approved ? [product.businessId] : []),
      new Set(favorite ? [id] : []),
    );
  }
  async favorite(actor: SessionUser, id: string, body: unknown) {
    const input = parse(z.object({ favorite: z.boolean() }), body);
    const product = await this.db.product.findFirst({
      where: {
        id,
        moderation: "APPROVED",
        business: { verificationStatus: "VERIFIED" },
      },
    });
    if (!product) throw new NotFoundException("Product not found");
    if (input.favorite)
      await this.db.favorite.upsert({
        where: {
          sellerId_productId: { sellerId: actor.sellerId!, productId: id },
        },
        create: { sellerId: actor.sellerId!, productId: id },
        update: {},
      });
    else
      await this.db.favorite.deleteMany({
        where: { sellerId: actor.sellerId!, productId: id },
      });
    return { favorite: input.favorite };
  }
  async contact(actor: SessionUser, body: unknown) {
    const input = parse(inquirySchema, body);
    return this.db.serial(async (tx) => {
      const old = await tx.inquiry.findUnique({
        where: { requestKey: input.requestKey },
      });
      if (
        old &&
        (old.sellerId !== actor.sellerId ||
          old.productId !== input.productId ||
          old.quantity !== input.quantity ||
          old.note !== input.note ||
          old.channel !== input.channel)
      )
        throw new BadRequestException("Inquiry request key was already used");
      const product = await tx.product.findFirst({
        where: {
          id: input.productId,
          moderation: "APPROVED",
          business: { verificationStatus: "VERIFIED" },
        },
        include: { business: true },
      });
      if (!product)
        throw new NotFoundException("Product is no longer available");
      if (
        product.business.contactPreference !== "BOTH" &&
        product.business.contactPreference !== input.channel
      )
        throw new BadRequestException(
          `This supplier prefers ${product.business.contactPreference.toLowerCase()} inquiries`,
        );
      if (input.quantity < product.moq)
        throw new BadRequestException(
          `Minimum order quantity is ${product.moq} units`,
        );
      const inquiry =
        old ||
        (await tx.inquiry.create({
          data: {
            ...input,
            businessId: product.businessId,
            sellerId: actor.sellerId!,
          },
        }));
      if (!old) {
        await notify(
          tx,
          product.businessId,
          null,
          "New sourcing inquiry",
          `${actor.name} asked for ${input.quantity} units of ${product.name}`,
          "/dashboard/buyers",
        );
        await audit(
          tx,
          actor.id,
          product.businessId,
          "SELLER_CONTACT",
          inquiry.id,
          `${product.sku} · ${input.channel}`,
        );
      }
      const message = `Hello ${product.business.name}, I am ${actor.name}. I am interested in ${product.name} (SKU ${product.sku}), ${input.quantity} units. ${input.note}\nReference: ${process.env.WEB_ORIGIN}/seller/products/${product.id}`;
      return {
        inquiryId: inquiry.id,
        href:
          input.channel === "CALL"
            ? `tel:+91${product.business.phone}`
            : `https://wa.me/91${product.business.phone}?text=${encodeURIComponent(message)}`,
      };
    });
  }
  async inquiries(actor: SessionUser) {
    return this.db.inquiry.findMany({
      where: { sellerId: actor.sellerId! },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        business: { select: { name: true, phone: true, marketArea: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
  async suppliers(actor: SessionUser) {
    const favorites = await this.db.supplierFavorite.findMany({
      where: { sellerId: actor.sellerId! },
      select: { businessId: true },
    });
    const saved = new Set(favorites.map((f) => f.businessId));
    const shops = await this.db.business.findMany({
      where: { verificationStatus: "VERIFIED" },
      select: {
        id: true,
        name: true,
        city: true,
        marketArea: true,
        address: true,
        phone: true,
        categories: true,
        moq: true,
        deliveryInfo: true,
        description: true,
        verificationStatus: true,
        _count: { select: { products: { where: { moderation: "APPROVED" } } } },
      },
      orderBy: { name: "asc" },
      take: 200,
    });
    return shops.map((s) => ({ ...s, favorite: saved.has(s.id) }));
  }
  async saveSupplier(actor: SessionUser, id: string, body: unknown) {
    const input = parse(z.object({ favorite: z.boolean() }), body);
    if (
      !(await this.db.business.findFirst({
        where: { id, verificationStatus: "VERIFIED" },
      }))
    )
      throw new NotFoundException("Verified supplier not found");
    if (input.favorite)
      await this.db.supplierFavorite.upsert({
        where: {
          businessId_sellerId: { businessId: id, sellerId: actor.sellerId! },
        },
        create: { businessId: id, sellerId: actor.sellerId! },
        update: {},
      });
    else
      await this.db.supplierFavorite.deleteMany({
        where: { businessId: id, sellerId: actor.sellerId! },
      });
    return { ok: true };
  }
  async profile(actor: SessionUser) {
    const [seller, uploads] = await Promise.all([
      this.db.seller.findUniqueOrThrow({
        where: { id: actor.sellerId! },
        include: { user: { select: { name: true, phone: true } } },
      }),
      this.db.upload.findMany({
        where: { userId: actor.id, kind: "KYC" },
        select: { id: true, fileName: true },
      }),
    ]);
    return { ...seller, uploads };
  }
  async updateProfile(actor: SessionUser, body: unknown) {
    const { name, ...data } = parse(sellerSchema, body);
    return this.db.serial(async (tx) => {
      await tx.user.update({ where: { id: actor.id }, data: { name } });
      return tx.seller.update({
        where: { id: actor.sellerId! },
        data: { ...data, verificationStatus: "PENDING", verificationNote: "" },
      });
    });
  }
  async rankings() {
    const rows = await this.db.$queryRaw<
      {
        category: string;
        products: bigint;
        views: bigint;
        sold: bigint;
        stockMovement: bigint;
        searches: bigint;
      }[]
    >`
      SELECT p.category, COUNT(*) AS products, SUM(p."viewCount") AS views, SUM(p."soldUnits") AS sold,
      COALESCE((SELECT SUM(GREATEST(sm.quantity,0)) FROM "StockMovement" sm JOIN "Product" mp ON mp.id=sm."productId" JOIN "Business" mb ON mb.id=mp."businessId"
        WHERE mp.category=p.category AND mp.moderation='APPROVED' AND mb."verificationStatus"='VERIFIED' AND sm."createdAt">NOW()-INTERVAL '30 days'),0) AS "stockMovement",
      (SELECT COUNT(*) FROM "SearchEvent" se WHERE (se.category=p.category OR (se.category='' AND se.query=LOWER(p.category))) AND se."createdAt">NOW()-INTERVAL '30 days') AS searches
      FROM "Product" p JOIN "Business" b ON b.id=p."businessId" WHERE p.moderation='APPROVED' AND b."verificationStatus"='VERIFIED' GROUP BY p.category`;
    return rows
      .map((r) => ({
        category: r.category,
        products: Number(r.products),
        views: Number(r.views),
        sold: Number(r.sold),
        stockMovement: Number(r.stockMovement),
        searches: Number(r.searches),
        score:
          Number(r.sold) * 3 +
          Number(r.views) +
          Number(r.stockMovement) +
          Number(r.searches),
      }))
      .sort(
        (a, b) => b.score - a.score || a.category.localeCompare(b.category),
      );
  }
  async buyers(actor: SessionUser) {
    const [inquiries, invoices, access] = await Promise.all([
      this.db.inquiry.findMany({
        where: { businessId: actor.businessId! },
        include: {
          seller: {
            include: { user: { select: { name: true, phone: true } } },
          },
          product: { select: { id: true, name: true, sku: true } },
          invoice: { select: { id: true, number: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      this.db.invoice.findMany({
        where: { businessId: actor.businessId! },
        orderBy: { createdAt: "desc" },
      }),
      this.db.sellerAccess.findMany({
        where: { businessId: actor.businessId! },
      }),
    ]);
    const groups = new Map<
      string,
      {
        name: string;
        phone: string;
        invoiceCount: number;
        salesPaise: number;
        duePaise: number;
        lastPurchase: Date;
        invoices: {
          id: string;
          number: string;
          createdAt: Date;
          totalPaise: number;
          duePaise: number;
        }[];
      }
    >();
    for (const i of invoices) {
      const state = paymentState(
        i.totalPaise,
        i.returnedPaise,
        i.paidPaise,
        i.status === "CANCELLED",
      );
      let buyer = groups.get(i.buyerPhone);
      if (!buyer) {
        buyer = {
          name: i.buyerName,
          phone: i.buyerPhone,
          invoiceCount: 0,
          salesPaise: 0,
          duePaise: 0,
          lastPurchase: i.createdAt,
          invoices: [],
        };
        groups.set(i.buyerPhone, buyer);
      }
      if (i.status !== "CANCELLED") {
        buyer.invoiceCount++;
        buyer.salesPaise += state.netPaise;
        buyer.duePaise += state.duePaise;
      }
      buyer.invoices.push({
        id: i.id,
        number: i.number,
        createdAt: i.createdAt,
        totalPaise: state.netPaise,
        duePaise: state.duePaise,
      });
    }
    return {
      buyers: [...groups.values()],
      inquiries: inquiries.map((i) => ({
        ...i,
        priceAccess: access.some(
          (a) => a.sellerId === i.sellerId && a.approved,
        ),
      })),
    };
  }
  async updateInquiry(actor: SessionUser, id: string, body: unknown) {
    const input = parse(
      z.object({
        status: z.enum(["NEW", "CONTACTED", "QUOTED", "WON", "LOST"]),
        ownerNote: z.string().trim().max(500).default(""),
      }),
      body,
    );
    return this.db.serial(async (tx) => {
      const old = await tx.inquiry.findFirst({
        where: { id, businessId: actor.businessId! },
      });
      if (!old) throw new NotFoundException("Inquiry not found");
      const result = await tx.inquiry.update({ where: { id }, data: input });
      await notify(
        tx,
        null,
        (await tx.seller.findUniqueOrThrow({ where: { id: old.sellerId } }))
          .userId,
        "Inquiry updated",
        `Your sourcing inquiry is now ${input.status.toLowerCase()}`,
        "/seller/inquiries",
      );
      await audit(
        tx,
        actor.id,
        actor.businessId,
        "INQUIRY_UPDATED",
        id,
        input.status,
      );
      return result;
    });
  }
  async grant(actor: SessionUser, sellerId: string, body: unknown) {
    const input = parse(z.object({ approved: z.boolean() }), body);
    const seller = await this.db.seller.findUnique({ where: { id: sellerId } });
    if (!seller) throw new NotFoundException("Seller not found");
    return this.db.serial(async (tx) => {
      const result = await tx.sellerAccess.upsert({
        where: {
          businessId_sellerId: { businessId: actor.businessId!, sellerId },
        },
        create: {
          businessId: actor.businessId!,
          sellerId,
          approved: input.approved,
        },
        update: { approved: input.approved },
      });
      await audit(
        tx,
        actor.id,
        actor.businessId,
        "SELLER_PRICE_ACCESS",
        sellerId,
        input.approved ? "Approved private pricing" : "Revoked private pricing",
      );
      return result;
    });
  }
}
@Controller("v1/seller")
@UseGuards(SessionGuard)
@AllowRoles("SELLER")
export class SellerController {
  constructor(
    @Inject(SourcingService) private readonly service: SourcingService,
  ) {}
  @Get("discover") discover(
    @Req() req: AuthRequest,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.service.discover(req.actor, query);
  }
  @Get("categories") categories() {
    return this.service.rankings();
  }
  @Get("profile") profile(@Req() req: AuthRequest) {
    return this.service.profile(req.actor);
  }
  @Patch("profile") saveProfile(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.service.updateProfile(req.actor, body);
  }
  @Post("suppliers/:id/favorite") saveSupplier(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.saveSupplier(req.actor, id, body);
  }
  @Get("products/:id") product(
    @Req() req: AuthRequest,
    @Param("id") id: string,
  ) {
    return this.service.one(req.actor, id);
  }
  @Post("products/:id/favorite") favorite(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.favorite(req.actor, id, body);
  }
  @Post("contact") contact(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.service.contact(req.actor, body);
  }
  @Get("inquiries") inquiries(@Req() req: AuthRequest) {
    return this.service.inquiries(req.actor);
  }
  @Get("suppliers") suppliers(@Req() req: AuthRequest) {
    return this.service.suppliers(req.actor);
  }
}
@Controller("v1/buyers")
@UseGuards(SessionGuard)
export class BuyersController {
  constructor(
    @Inject(SourcingService) private readonly service: SourcingService,
  ) {}
  @Get() @Ability("SELLERS", "VIEW") buyers(@Req() req: AuthRequest) {
    return this.service.buyers(req.actor);
  }
  @Patch("inquiries/:id") @Ability("SELLERS", "EDIT") update(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateInquiry(req.actor, id, body);
  }
  @Post("price-access/:id") @Ability("SELLERS", "EDIT") grant(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.grant(req.actor, id, body);
  }
}
@Module({
  imports: [AuthModule],
  providers: [SourcingService],
  controllers: [SellerController, BuyersController],
})
export class SourcingModule {}
