import { z } from "zod";
import type { PrismaClient } from "@prisma/client";

const httpsUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Use a public HTTPS source");
export const supplierListingSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,80}$/),
  name: z.string().trim().min(2).max(120),
  phone: z.string().regex(/^[6-9][0-9]{9}$/),
  email: z.union([z.literal(""), z.string().email()]).default(""),
  city: z.literal("Surat"),
  marketArea: z.string().trim().min(2).max(100),
  address: z.string().trim().min(10).max(500),
  categories: z.array(z.string().trim().min(2).max(60)).min(1).max(12),
  description: z.string().trim().min(10).max(600),
  website: httpsUrl,
  sourceUrl: httpsUrl,
  checkedAt: z.string().datetime(),
}).strict().refine((value) => new URL(value.website).hostname.replace(/^www\./, "") === new URL(value.sourceUrl).hostname.replace(/^www\./, ""), "Source must belong to the business website");

export async function importSupplierListings(db: PrismaClient, input: unknown) {
  const rows = z.array(supplierListingSchema).min(1).max(200).parse(input);
  if (new Set(rows.map((row) => row.id)).size !== rows.length)
    throw new Error("Duplicate supplier listing IDs");
  await db.$transaction(rows.map(({ checkedAt, ...row }) => {
    const data = { ...row, checkedAt: new Date(checkedAt) };
    return db.supplierListing.upsert({ where: { id: row.id }, create: data, update: data });
  }));
  return rows.length;
}
