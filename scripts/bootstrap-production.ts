import { PrismaClient } from "@prisma/client";
import { defaultPlans } from "../packages/db/default-plans";

async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(["--phone", "--name"]);
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    if (
      !allowed.has(args[i]) ||
      !args[i + 1] ||
      args[i + 1].startsWith("--") ||
      options.has(args[i])
    )
      throw new Error(
        'Usage: npm run production:bootstrap -- --phone <mobile> --name "Platform Admin" (or omit both to initialize plans only)',
      );
    options.set(args[i], args[i + 1]);
  }
  const phone = options.get("--phone"),
    name = options.get("--name")?.trim();
  if (
    (phone || name) &&
    (!phone ||
      !/^[6-9]\d{9}$/.test(phone) ||
      !name ||
      name.length < 2 ||
      name.length > 80)
  )
    throw new Error(
      "Provide a valid 10-digit mobile and administrator name (2–80 characters)",
    );
  const db = new PrismaClient();
  try {
    await db.$transaction(
      async (tx) => {
        // Fail before creating anything if this would promote an existing customer.
        const existing = phone
          ? await tx.user.findUnique({ where: { phone } })
          : null;
        if (
          existing &&
          (existing.role !== "PLATFORM_ADMIN" ||
            existing.disabled ||
            existing.isSample)
        )
          throw new Error(
            "Phone already belongs to an ineligible account; no account or plan was changed",
          );
        for (const plan of defaultPlans) {
          const found = await tx.plan.findFirst({
            where: { OR: [{ id: plan.id }, { name: plan.name }] },
          });
          if (!found) await tx.plan.create({ data: plan });
        }
        if (phone && name && !existing)
          await tx.user.create({
            data: { phone, name, role: "PLATFORM_ADMIN" },
          });
      },
      { isolationLevel: "Serializable" },
    );
    console.log(
      "Subscription defaults initialized; existing pricing and limits preserved. No demo data created.",
    );
    if (phone)
      console.log(
        "Administrator is available for configured mobile OTP sign-in; existing accounts were not modified.",
      );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error && error.name === "Error"
      ? error.message
      : "Bootstrap failed; inspect database connectivity and migrations. Nothing was partially committed.",
  );
  process.exitCode = 1;
});
