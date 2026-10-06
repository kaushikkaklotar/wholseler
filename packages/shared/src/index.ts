import { z } from "zod";

export const roles = [
  "PLATFORM_ADMIN",
  "PLATFORM_OPERATIONS",
  "WHOLESALER_OWNER",
  "WHOLESALER_STAFF",
  "SELLER",
] as const;
export type Role = (typeof roles)[number];
export const modules = [
  "DASHBOARD",
  "PRODUCTS",
  "INVENTORY",
  "BILLING",
  "SELLERS",
  "REPORTS",
  "STAFF",
  "SETTINGS",
] as const;
export const actions = ["VIEW", "CREATE", "EDIT", "DELETE"] as const;
export type ModuleKey = (typeof modules)[number];
export type PermissionAction = (typeof actions)[number];
export type Permission = `${ModuleKey}:${PermissionAction}`;
export const moduleLabels: Record<ModuleKey, string> = {
  DASHBOARD: "Overview",
  PRODUCTS: "Catalog",
  INVENTORY: "Inventory",
  BILLING: "Billing",
  SELLERS: "Buyers & inquiries",
  REPORTS: "Reports",
  STAFF: "Team & permissions",
  SETTINGS: "Business settings",
};
export const categories = [
  "Kurtis",
  "Sarees",
  "Dress materials",
  "Menswear",
  "Kidswear",
  "Footwear",
  "Accessories",
  "Home textiles",
];
export const staffPresets: Record<string, Permission[]> = {
  Cashier: [
    "DASHBOARD:VIEW",
    "PRODUCTS:VIEW",
    "INVENTORY:VIEW",
    "BILLING:VIEW",
    "BILLING:CREATE",
    "BILLING:EDIT",
    "SELLERS:VIEW",
  ],
  "Catalog manager": [
    "DASHBOARD:VIEW",
    "PRODUCTS:VIEW",
    "PRODUCTS:CREATE",
    "PRODUCTS:EDIT",
    "INVENTORY:VIEW",
    "INVENTORY:CREATE",
    "INVENTORY:EDIT",
  ],
  "Store manager": modules
    .filter((m) => m !== "STAFF" && m !== "SETTINGS")
    .flatMap((m) => [`${m}:VIEW`, `${m}:CREATE`, `${m}:EDIT`] as Permission[]),
};
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s+-]/g, "").replace(/^91(?=\d{10}$)/, ""))
  .pipe(
    z
      .string()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10 digit Indian mobile number"),
  );
const text = (min = 1, max = 160) => z.string().trim().min(min).max(max);
const amount = z.number().int().min(0).max(100_000_000);
export const gstSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(
    (v) => !v || /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(v),
    "Enter a valid GSTIN",
  );
export const requestOtpSchema = z.object({
  phone: phoneSchema,
  accountType: z
    .enum(["WHOLESALER_OWNER", "SELLER"])
    .default("WHOLESALER_OWNER"),
  intent: z.enum(["LOGIN", "REGISTER"]).default("LOGIN"),
  portal: z.enum(["WHOLESALER", "SELLER", "TEAM"]).default("WHOLESALER"),
});
export const verifyOtpSchema = z.object({
  challengeId: text(),
  code: z.string().regex(/^\d{6}$/),
});
export const businessSchema = z.object({
  name: text(2, 100),
  phone: phoneSchema,
  address: text(5, 500),
  city: text(2, 80),
  marketArea: text(2, 100),
  categories: z.array(text()).min(1).max(12),
  gstNumber: gstSchema.default(""),
  moq: z.number().int().min(1).max(100000).default(1),
  deliveryInfo: text(0, 300).default(""),
  description: text(0, 1000).default(""),
  invoicePrefix: z
    .string()
    .regex(/^[A-Z0-9-]{1,12}$/)
    .default("WH"),
});
export const sellerSchema = z.object({
  name: text(2, 80),
  businessName: text(2, 100),
  city: text(2, 80),
  gstNumber: gstSchema.default(""),
});
export const variantSchema = z.object({
  id: z.string().optional(),
  size: text(0, 40).default("Free size"),
  color: text(0, 40).default("Mixed"),
  stock: z.number().int().min(0).max(1000000).default(0),
  lowStockAt: z.number().int().min(0).max(100000).default(10),
});
export const productSchema = z
  .object({
    name: text(2, 160),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9._-]{2,40}$/),
    category: text(2, 80),
    description: text(0, 1500).default(""),
    pricePaise: amount.min(1),
    cartonPricePaise: amount.nullable().default(null),
    cartonUnits: z.number().int().min(1).max(100000).default(12),
    moq: z.number().int().min(1).max(100000).default(1),
    visibility: z
      .enum(["PUBLIC", "APPROVED_SELLERS", "INQUIRY"])
      .default("PUBLIC"),
    tags: z.array(text(1, 40)).max(15).default([]),
    imageIds: z.array(text()).max(8).default([]),
    variants: z.array(variantSchema).min(1).max(100),
  })
  .superRefine((p, ctx) => {
    const seen = new Set<string>();
    for (const v of p.variants) {
      const k = `${v.size.toLowerCase()}|${v.color.toLowerCase()}`;
      if (seen.has(k))
        ctx.addIssue({
          code: "custom",
          message: "Size and colour combinations must be unique",
          path: ["variants"],
        });
      seen.add(k);
    }
    if (p.cartonPricePaise === 0)
      ctx.addIssue({
        code: "custom",
        message: "Carton price must be greater than zero",
        path: ["cartonPricePaise"],
      });
  });
export const stockSchema = z
  .object({
    variantId: text(),
    type: z.enum(["PURCHASE", "ADJUSTMENT", "STOCK_OUT"]),
    quantity: z
      .number()
      .int()
      .min(-1000000)
      .max(1000000)
      .refine((v) => v !== 0),
    note: text(3, 500),
    requestKey: z.string().uuid(),
  })
  .superRefine((v, c) => {
    if (v.type === "PURCHASE" && v.quantity < 0)
      c.addIssue({
        code: "custom",
        message: "Purchase quantity must be positive",
      });
    if (v.type === "STOCK_OUT" && v.quantity > 0)
      c.addIssue({
        code: "custom",
        message: "Stock out quantity must be negative",
      });
  });
export const invoiceSchema = z
  .object({
    requestKey: z.string().uuid(),
    buyerName: text(2, 100),
    buyerPhone: phoneSchema,
    buyerAddress: text(0, 500).default(""),
    buyerGst: gstSchema.default(""),
    inquiryId: z.string().optional(),
    items: z
      .array(
        z.object({
          variantId: text(),
          quantity: z.number().int().min(1).max(100000),
          unitPricePaise: amount.min(1),
        }),
      )
      .min(1)
      .max(100),
    discountPaise: amount.default(0),
    taxMode: z.enum(["NONE", "CGST_SGST", "IGST"]).default("NONE"),
    taxRateBps: z.number().int().min(0).max(3000).default(0),
    paidPaise: amount.default(0),
    paymentMode: z.enum(["CASH", "UPI", "BANK", "CREDIT"]).default("CASH"),
    note: text(0, 500).default(""),
  })
  .superRefine((v, c) => {
    if (new Set(v.items.map((i) => i.variantId)).size !== v.items.length)
      c.addIssue({
        code: "custom",
        message: "Merge duplicate variants into one invoice line",
      });
    if (v.taxMode === "NONE" && v.taxRateBps !== 0)
      c.addIssue({
        code: "custom",
        message: "Choose a tax mode before adding tax",
      });
    const subtotal = v.items.reduce(
      (s, i) => s + i.quantity * i.unitPricePaise,
      0,
    );
    if (subtotal > 1000000000)
      c.addIssue({ code: "custom", message: "Invoice value is too large" });
    if (v.discountPaise > subtotal)
      c.addIssue({
        code: "custom",
        message: "Discount cannot exceed subtotal",
      });
  });
export const returnSchema = z
  .object({
    requestKey: z.string().uuid(),
    reason: text(3, 500),
    items: z
      .array(
        z.object({
          itemId: text(),
          quantity: z.number().int().min(1).max(100000),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine(
    (v) => new Set(v.items.map((i) => i.itemId)).size === v.items.length,
    "Duplicate return lines",
  );
export const paymentSchema = z.object({
  requestKey: z.string().uuid(),
  amountPaise: amount.min(1),
  mode: z.enum(["CASH", "UPI", "BANK"]),
  note: text(0, 500).default(""),
});
export const permissionSchema = z.enum(modules).transform((v) => v);
export const staffSchema = z
  .object({
    name: text(2, 80),
    phone: phoneSchema,
    designation: text(2, 60),
    permissions: z
      .array(
        z.string().refine((v) => {
          const [m, a] = v.split(":");
          return (
            (modules as readonly string[]).includes(m) &&
            (actions as readonly string[]).includes(a)
          );
        }, "Invalid permission"),
      )
      .max(32),
    active: z.boolean().default(true),
  })
  .superRefine((s, c) => {
    for (const p of s.permissions) {
      const [m, a] = p.split(":");
      if (a !== "VIEW" && !s.permissions.includes(`${m}:VIEW`))
        c.addIssue({
          code: "custom",
          message: `Enable view access for ${moduleLabels[m as ModuleKey]} before giving edit/create/delete access`,
        });
    }
  });
export const inquirySchema = z.object({
  productId: text(),
  quantity: z.number().int().min(1).max(100000),
  note: text(0, 500).default(""),
  channel: z.enum(["WHATSAPP", "CALL"]),
  requestKey: z.string().uuid(),
});
export const planSchema = z.object({
  name: text(2, 60),
  monthlyPricePaise: amount,
  productLimit: z.number().int().min(1).max(100000),
  staffLimit: z.number().int().min(1).max(1000),
  active: z.boolean().default(true),
  bulkImport: z.boolean().default(false),
  advancedReports: z.boolean().default(false),
});
export type ProductInput = z.infer<typeof productSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type SessionUser = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  businessId: string | null;
  sellerId: string | null;
  permissions: Permission[];
  businessName: string | null;
  verificationStatus: string | null;
  hasGst?: boolean;
  onboardingRequired: boolean;
  plan?: {
    name: string;
    staffLimit: number;
    productLimit: number;
    monthlyPricePaise: number;
    bulkImport: boolean;
    advancedReports: boolean;
  };
};
export function money(paise: number, compact = false): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: compact ? 0 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(paise / 100);
}
export function toPaise(value: string | number): number {
  const s = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw new Error("Enter an amount with up to two decimal places");
  const [whole, fraction = ""] = s.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 100000000)
    throw new Error("Amount is too large");
  return result;
}
export function invoiceTotals(
  items: { quantity: number; unitPricePaise: number }[],
  discountPaise: number,
  taxRateBps: number,
) {
  const subtotalPaise = items.reduce(
    (s, i) => s + i.quantity * i.unitPricePaise,
    0,
  );
  if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise > 1000000000)
    throw new Error("Invoice value is too large");
  if (discountPaise > subtotalPaise)
    throw new Error("Discount cannot exceed the subtotal");
  const taxablePaise = subtotalPaise - discountPaise;
  const taxPaise = Math.round((taxablePaise * taxRateBps) / 10000);
  return {
    subtotalPaise,
    discountPaise,
    taxPaise,
    totalPaise: taxablePaise + taxPaise,
  };
}
export function splitLineTotals(
  items: { quantity: number; unitPricePaise: number }[],
  totalPaise: number,
) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPricePaise, 0);
  let assigned = 0;
  return items.map((i, index) => {
    const amount =
      index === items.length - 1
        ? totalPaise - assigned
        : Math.floor((totalPaise * i.quantity * i.unitPricePaise) / subtotal);
    assigned += amount;
    return amount;
  });
}
export function returnValue(
  lineTotalPaise: number,
  quantity: number,
  alreadyReturned: number,
  returnQuantity: number,
) {
  return (
    Math.floor(
      (lineTotalPaise * (alreadyReturned + returnQuantity)) / quantity,
    ) - Math.floor((lineTotalPaise * alreadyReturned) / quantity)
  );
}
export function paymentState(
  total: number,
  returned: number,
  paid: number,
  cancelled = false,
) {
  const net = cancelled ? 0 : total - returned;
  return {
    netPaise: net,
    duePaise: Math.max(0, net - paid),
    creditPaise: Math.max(0, paid - net),
    paymentStatus: cancelled
      ? "CANCELLED"
      : paid >= net
        ? "PAID"
        : paid > 0
          ? "PARTIAL"
          : "UNPAID",
  };
}
