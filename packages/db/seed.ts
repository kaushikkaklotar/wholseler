import "reflect-metadata";
import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  actions,
  modules,
  staffPresets,
  type SessionUser,
} from "@wholesale/shared";
import { Database } from "../../apps/api/src/database";
import { BillingService } from "../../apps/api/src/billing";
config({ path: path.resolve(".env"), quiet: true });
if (
  process.env.NODE_ENV === "production" ||
  process.env.AUTH_MODE !== "development" ||
  process.env.SEED_SAMPLE_DATA !== "true"
)
  throw new Error(
    "Sample data seeding is allowed only with AUTH_MODE=development and SEED_SAMPLE_DATA=true",
  );
const db = new Database();
const accounts = [
  {
    id: "sample-owner",
    name: "Aarav Shah",
    phone: "9000000001",
    role: "WHOLESALER_OWNER" as const,
  },
  {
    id: "sample-cashier",
    name: "Meera Patel",
    phone: "9000000002",
    role: "WHOLESALER_STAFF" as const,
  },
  {
    id: "sample-seller",
    name: "Riya Desai",
    phone: "9000000003",
    role: "SELLER" as const,
  },
  {
    id: "sample-admin",
    name: "Platform Admin",
    phone: "9000000004",
    role: "PLATFORM_ADMIN" as const,
  },
  {
    id: "sample-ops",
    name: "Onboarding Team",
    phone: "9000000005",
    role: "PLATFORM_OPERATIONS" as const,
  },
  {
    id: "sample-owner-2",
    name: "Dev Mehta",
    phone: "9000000006",
    role: "WHOLESALER_OWNER" as const,
  },
  {
    id: "sample-catalog",
    name: "Jay Solanki",
    phone: "9000000007",
    role: "WHOLESALER_STAFF" as const,
  },
  {
    id: "sample-pending",
    name: "Nisha Joshi",
    phone: "9000000008",
    role: "WHOLESALER_OWNER" as const,
  },
];
function illustration(colour: string, category: string) {
  const garment =
    category === "Sarees"
      ? `<path d="M135 90h230v320H135z" fill="${colour}"/><path d="M135 115h230M135 355h230" stroke="#e8cf9f" stroke-width="18"/><path d="M280 90v320" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>`
      : category === "Menswear"
        ? `<path d="M196 98l54 22 54-22 68 72-49 44-25-29v213H202V185l-25 29-49-44z" fill="${colour}"/><path d="M250 120v278M219 110l31 33 31-33" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="3"/><path d="M274 180h26v26h-26z" fill="#fff" fill-opacity=".2"/>`
        : `<path d="M195 100l55 18 55-18 56 69-42 39-27-33 30 224H178l30-224-27 33-42-39z" fill="${colour}"/><path d="M221 108q29 69 58 0" fill="none" stroke="#e9d9b3" stroke-width="5"/><path d="M186 368h128" stroke="#e9d9b3" stroke-width="12"/><g fill="#fff" fill-opacity=".45">${Array.from({ length: 20 }, (_, i) => `<circle cx="${210 + (i % 4) * 27}" cy="${177 + Math.floor(i / 4) * 34}" r="3"/>`).join("")}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500"><rect width="500" height="500" fill="#f2efea"/><ellipse cx="250" cy="418" rx="135" ry="16" fill="#e4ded5"/><path d="M248 58q0-23 16-16t-6 28l-87 40h158l-79-36" fill="none" stroke="#b5ab9b" stroke-width="4" stroke-linecap="round"/>${garment}<text x="250" y="474" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#aaa297" letter-spacing="3">SAMPLE CATALOG</text></svg>`;
}
async function main() {
  await db.$connect();
  for (const account of accounts) {
    const existing = await db.user.findUnique({
      where: { phone: account.phone },
    });
    if (existing && !existing.isSample)
      throw new Error(
        `Sample phone ${account.phone} conflicts with an existing account; no data was overwritten`,
      );
    await db.user.upsert({
      where: { id: account.id },
      create: { ...account, isSample: true },
      update: {},
    });
  }
  const plans = [
    {
      id: "plan-starter",
      name: "Starter",
      monthlyPricePaise: 99900,
      productLimit: 500,
      staffLimit: 3,
      bulkImport: false,
      advancedReports: false,
    },
    {
      id: "plan-growth",
      name: "Growth",
      monthlyPricePaise: 199900,
      productLimit: 3000,
      staffLimit: 8,
      bulkImport: true,
      advancedReports: true,
    },
    {
      id: "plan-pro",
      name: "Pro",
      monthlyPricePaise: 349900,
      productLimit: 10000,
      staffLimit: 20,
      bulkImport: true,
      advancedReports: true,
    },
  ];
  for (const plan of plans)
    await db.plan.upsert({ where: { id: plan.id }, create: plan, update: {} });
  const existed = await db.business.findUnique({
    where: { id: "sample-surati" },
  });
  await db.business.upsert({
    where: { id: "sample-surati" },
    create: {
      id: "sample-surati",
      ownerId: "sample-owner",
      planId: "plan-growth",
      name: "Surati Threads",
      phone: "9000000001",
      address: "Shop 204, Ring Road Textile Market",
      city: "Surat",
      marketArea: "Ring Road",
      categories: ["Kurtis", "Sarees", "Dress materials"],
      description:
        "Everyday and occasion wear, straight from the textile market.",
      moq: 6,
      deliveryInfo: "Dispatch within 2 working days · Courier across India",
      verificationStatus: "VERIFIED",
      invoicePrefix: "ST",
      isSample: true,
    },
    update: {},
  });
  await db.business.upsert({
    where: { id: "sample-mehta" },
    create: {
      id: "sample-mehta",
      ownerId: "sample-owner-2",
      planId: "plan-starter",
      name: "Mehta Apparel Co.",
      phone: "9000000006",
      address: "Shop 16, New Bombay Market",
      city: "Surat",
      marketArea: "New Bombay Market",
      categories: ["Menswear", "Kidswear"],
      description: "Menswear essentials for retail stores.",
      moq: 12,
      deliveryInfo: "Pan India delivery",
      verificationStatus: "VERIFIED",
      invoicePrefix: "MA",
      isSample: true,
    },
    update: {},
  });
  await db.business.upsert({
    where: { id: "sample-nisha" },
    create: {
      id: "sample-nisha",
      ownerId: "sample-pending",
      planId: "plan-starter",
      name: "Nisha Textiles",
      phone: "9000000008",
      address: "Shop 38, Sahara Darwaja",
      city: "Surat",
      marketArea: "Sahara Darwaja",
      categories: ["Sarees"],
      description: "New business awaiting catalog setup",
      verificationStatus: "PENDING",
      onboardingNote:
        "Profile collected. Product photos and owner verification pending.",
      isSample: true,
    },
    update: {},
  });
  await db.staff.upsert({
    where: { userId: "sample-cashier" },
    create: {
      businessId: "sample-surati",
      userId: "sample-cashier",
      designation: "Cashier",
      permissions: staffPresets.Cashier,
    },
    update: {},
  });
  await db.staff.upsert({
    where: { userId: "sample-catalog" },
    create: {
      businessId: "sample-surati",
      userId: "sample-catalog",
      designation: "Catalog manager",
      permissions: staffPresets["Catalog manager"],
    },
    update: {},
  });
  const seller = await db.seller.upsert({
    where: { userId: "sample-seller" },
    create: {
      userId: "sample-seller",
      businessName: "Riya Retail",
      city: "Ahmedabad",
      verificationStatus: "VERIFIED",
    },
    update: {},
  });
  await db.sellerAccess.upsert({
    where: {
      businessId_sellerId: { businessId: "sample-surati", sellerId: seller.id },
    },
    create: {
      businessId: "sample-surati",
      sellerId: seller.id,
      approved: true,
    },
    update: {},
  });
  const goods = [
    [
      "Cotton printed kurti",
      "ST-KT-101",
      "Kurtis",
      38500,
      "#859687",
      180,
      "PUBLIC",
    ],
    [
      "Chanderi festive set",
      "ST-KT-102",
      "Kurtis",
      74500,
      "#b67978",
      120,
      "PUBLIC",
    ],
    [
      "Everyday rayon kurti",
      "ST-KT-103",
      "Kurtis",
      29500,
      "#8084a2",
      8,
      "PUBLIC",
    ],
    [
      "Banarasi silk saree",
      "ST-SA-201",
      "Sarees",
      125000,
      "#ae7555",
      80,
      "APPROVED_SELLERS",
    ],
    ["Soft linen saree", "ST-SA-202", "Sarees", 68000, "#9d878f", 6, "PUBLIC"],
    [
      "Floral cotton dress material",
      "ST-DM-301",
      "Dress materials",
      42000,
      "#a5b29b",
      150,
      "PUBLIC",
    ],
    [
      "Embroidered straight kurti",
      "ST-KT-104",
      "Kurtis",
      59000,
      "#b8a477",
      72,
      "INQUIRY",
    ],
    [
      "Premium georgette saree",
      "ST-SA-203",
      "Sarees",
      89000,
      "#778e9d",
      0,
      "PUBLIC",
    ],
    [
      "Summer co-ord set",
      "ST-KT-105",
      "Kurtis",
      85000,
      "#aca282",
      96,
      "PUBLIC",
    ],
    [
      "Linen blend shirt",
      "MA-SH-101",
      "Menswear",
      51000,
      "#8d9d9c",
      200,
      "PUBLIC",
    ],
    [
      "Oxford casual shirt",
      "MA-SH-102",
      "Menswear",
      62500,
      "#989eae",
      100,
      "PUBLIC",
    ],
    [
      "Premium cotton shirt",
      "MA-SH-103",
      "Menswear",
      72000,
      "#b79987",
      75,
      "APPROVED_SELLERS",
    ],
  ] as const;
  await mkdir(path.resolve(".data/uploads"), { recursive: true });
  for (let i = 0; i < goods.length; i++) {
    const [name, sku, category, pricePaise, colour, stock, visibility] =
      goods[i];
    const id = `sample-product-${i + 1}`;
    const businessId = i < 9 ? "sample-surati" : "sample-mehta",
      ownerId = i < 9 ? "sample-owner" : "sample-owner-2";
    if (!(await db.product.findUnique({ where: { id } }))) {
      const product = await db.product.create({
        data: {
          id,
          businessId,
          name,
          sku,
          category,
          pricePaise,
          cartonPricePaise: pricePaise * 12 - 12000,
          cartonUnits: 12,
          moq: 6,
          visibility,
          moderation: "APPROVED",
          description:
            "Sample catalog item for local workflow review. Upload your actual product photos and specifications before using this catalog for real trade.",
          tags: ["Cotton", "New arrival"],
          viewCount: 50 + i * 11,
          createdAt: new Date(Date.now() - 8 * 86400000),
          variants: {
            create: [
              {
                id: `${id}-m`,
                businessId,
                size:
                  category === "Sarees" || category === "Dress materials"
                    ? "Free size"
                    : "M",
                color: i % 2 ? "Rose" : "Sage",
                stock,
                lowStockAt: 10,
              },
              {
                id: `${id}-l`,
                businessId,
                size:
                  category === "Sarees" || category === "Dress materials"
                    ? "Free size"
                    : "L",
                color: "Ivory",
                stock: stock ? Math.floor(stock / 2) : 0,
                lowStockAt: 10,
              },
            ],
          },
        },
        include: { variants: true },
      });
      await db.stockMovement.createMany({
        data: product.variants
          .filter((v) => v.stock > 0)
          .map((v) => ({
            businessId,
            productId: id,
            variantId: v.id,
            actorId: ownerId,
            type: "OPENING",
            quantity: v.stock,
            balanceAfter: v.stock,
            note: "Sample opening inventory",
            createdAt: new Date(Date.now() - 8 * 86400000),
          })),
      });
    }
    const key = `${id}.webp`;
    await writeFile(
      path.resolve(".data/uploads", key),
      await sharp(Buffer.from(illustration(colour, category)))
        .webp({ quality: 90 })
        .toBuffer(),
    );
    await db.upload.upsert({
      where: { storageKey: key },
      create: {
        businessId,
        userId: ownerId,
        productId: id,
        kind: "PRODUCT",
        mime: "image/webp",
        fileName: `${sku}.webp`,
        storageKey: key,
        size: 10000,
      },
      update: {},
    });
  }
  if (!existed) {
    const actor: SessionUser = {
      id: "sample-owner",
      name: "Aarav Shah",
      phone: "9000000001",
      role: "WHOLESALER_OWNER",
      businessId: "sample-surati",
      businessName: "Surati Threads",
      sellerId: null,
      verificationStatus: "VERIFIED",
      permissions: modules.flatMap((m) => actions.map((a) => `${m}:${a}`)),
      onboardingRequired: false,
    };
    const billing = new BillingService(db);
    const saleProducts = [
      "sample-product-1-m",
      "sample-product-2-m",
      "sample-product-6-m",
      "sample-product-9-m",
    ];
    for (let day = 6; day >= 0; day--) {
      for (let n = 0; n < (day === 0 ? 3 : 2); n++) {
        const variantId = saleProducts[(day + n) % saleProducts.length];
        const variant = await db.variant.findUniqueOrThrow({
          where: { id: variantId },
          include: { product: true },
        });
        const quantity = 6 + n * 3 + day;
        const paid = n === 1 ? 0 : quantity * variant.product.pricePaise;
        const invoice = await billing.create(actor, {
          requestKey: randomUUID(),
          buyerName: ["Riya Retail", "Kavya Boutique", "Shree Fashion House"][
            n
          ],
          buyerPhone: ["9000000003", "9000000011", "9000000012"][n],
          items: [
            { variantId, quantity, unitPricePaise: variant.product.pricePaise },
          ],
          paidPaise: paid,
          paymentMode: paid ? "UPI" : "CREDIT",
        });
        const at = new Date(Date.now() - day * 86400000);
        await db.invoice.update({
          where: { id: invoice.id },
          data: { createdAt: at },
        });
        await db.stockMovement.updateMany({
          where: { reference: invoice.id },
          data: { createdAt: at },
        });
        await db.payment.updateMany({
          where: { invoiceId: invoice.id },
          data: { createdAt: at },
        });
      }
    }
    await db.inquiry.createMany({
      data: [
        {
          businessId: "sample-surati",
          sellerId: seller.id,
          productId: "sample-product-4",
          quantity: 24,
          channel: "WHATSAPP",
          requestKey: randomUUID(),
          note: "Please share the available colours and dispatch time.",
        },
        {
          businessId: "sample-surati",
          sellerId: seller.id,
          productId: "sample-product-7",
          quantity: 12,
          channel: "CALL",
          requestKey: randomUUID(),
          note: "Looking for a regular supplier for our retail store.",
        },
      ],
    });
    await db.notification.create({
      data: {
        businessId: "sample-surati",
        title: "Your workspace is ready",
        body: "This is a sample workspace. Try catalog, inventory and billing before adding your real business data.",
        href: "/dashboard",
        readBy: [],
      },
    });
    await db.supportTicket.create({
      data: {
        businessId: "sample-nisha",
        userId: "sample-pending",
        subject: "Help us upload our first catalog",
        category: "CATALOG",
        messages: {
          create: {
            userId: "sample-pending",
            text: "We have the product details ready. Please guide us with the bulk import template.",
          },
        },
      },
    });
  }
  console.log(
    "Sample workspace seeded. No SMS was sent. Owner: 9000000001; cashier: 9000000002; seller: 9000000003; admin: 9000000004; operations: 9000000005.",
  );
}
main().finally(() => db.$disconnect());
