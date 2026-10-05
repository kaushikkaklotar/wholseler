import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
config({ quiet: true });
const args = process.argv.slice(2),
  read = (key) => args[args.indexOf(key) + 1];
const phone = read("--phone"),
  name = read("--name");
if (
  !args.includes("--phone") ||
  !args.includes("--name") ||
  !phone ||
  !name ||
  !/^[6-9]\d{9}$/.test(phone) ||
  name.length < 2
)
  throw new Error(
    'Usage: node scripts/create-admin.mjs --phone <10-digit-mobile> --name "Administrator name"',
  );
const db = new PrismaClient();
try {
  if (await db.user.findUnique({ where: { phone } }))
    throw new Error(
      "This phone is already registered. No existing account was modified",
    );
  await db.user.create({ data: { phone, name, role: "PLATFORM_ADMIN" } });
  console.log("Administrator created. Sign in using configured mobile OTP.");
} finally {
  await db.$disconnect();
}
