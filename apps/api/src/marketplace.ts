import {
  Controller,
  Get,
  Inject,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Database } from "./database";

// Only published catalog information is selected. Private prices, contacts,
// account identifiers, invoices and verification files never enter this DTO.
const selection = {
  id: true,
  name: true,
  category: true,
  description: true,
  moq: true,
  pricePaise: true,
  visibility: true,
  tags: true,
  images: { select: { id: true } },
  variants: {
    where: { archived: false },
    select: { size: true, color: true, stock: true, reserved: true },
  },
  business: {
    select: {
      name: true,
      city: true,
      marketArea: true,
      description: true,
      deliveryInfo: true,
    },
  },
} satisfies Prisma.ProductSelect;
type Product = Prisma.ProductGetPayload<{ select: typeof selection }>;
export function marketplaceProduct(product: Product) {
  const { visibility, images, ...publicData } = product;
  return {
    ...publicData,
    pricePaise: visibility === "PUBLIC" ? product.pricePaise : null,
    images: images.map((image) => ({ url: `/api/v1/media/${image.id}` })),
    variants: product.variants.map(({ reserved, ...v }) => ({
      ...v,
      stock: v.stock - reserved,
    })),
    stock: product.variants.reduce(
      (total, variant) => total + variant.stock - variant.reserved,
      0,
    ),
  };
}
@Injectable()
export class MarketplaceService {
  constructor(@Inject(Database) private readonly db: Database) {}
  async products(query: Record<string, string | undefined>) {
    const q = query.q?.trim().slice(0, 100) || "";
    const page = Math.min(
      100000,
      Math.max(1, Math.floor(Number(query.page) || 1)),
    );
    const where: Prisma.ProductWhereInput = {
      moderation: "APPROVED",
      business: {
        verificationStatus: "VERIFIED",
        ...(query.city
          ? { city: { contains: query.city.slice(0, 80), mode: "insensitive" } }
          : {}),
      },
      ...(query.category ? { category: query.category.slice(0, 80) } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
              { business: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [products, total] = await this.db.$transaction([
      this.db.product.findMany({
        where,
        select: selection,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * 12,
        take: 12,
      }),
      this.db.product.count({ where }),
    ]);
    return { products: products.map(marketplaceProduct), total, page };
  }
  async one(id: string) {
    const product = await this.db.product.findFirst({
      where: {
        id,
        moderation: "APPROVED",
        business: { verificationStatus: "VERIFIED" },
      },
      select: selection,
    });
    if (!product)
      throw new NotFoundException("This product is no longer available");
    return marketplaceProduct(product);
  }
  async plans() {
    return this.db.plan.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        monthlyPricePaise: true,
        productLimit: true,
        staffLimit: true,
        bulkImport: true,
        advancedReports: true,
      },
      orderBy: { monthlyPricePaise: "asc" },
    });
  }
}
@Controller("v1/marketplace")
class MarketplaceController {
  constructor(
    @Inject(MarketplaceService) private readonly market: MarketplaceService,
  ) {}
  @Get("products") products(
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.market.products(query);
  }
  @Get("products/:id") one(@Param("id") id: string) {
    return this.market.one(id);
  }
  @Get("plans") plans() {
    return this.market.plans();
  }
}
@Module({
  providers: [MarketplaceService],
  controllers: [MarketplaceController],
})
export class MarketplaceModule {}
