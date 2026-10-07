import type { PrismaClient } from "@prisma/client";
import { readdir } from "node:fs/promises";
import path from "node:path";

export type LaunchCheck = {
  id: string;
  status: "PASS" | "FAIL" | "WARN";
  message: string;
};
type Env = Record<string, string | undefined>;
const filled = (value: string | undefined) =>
  !!value?.trim() && !/replace-with|your[-_ ]|example\./i.test(value);

// Return names and reasons only. Never include credential values in diagnostics.
export function productionConfigChecks(env: Env): LaunchCheck[] {
  const checks: LaunchCheck[] = [];
  const check = (id: string, ok: boolean, message: string) =>
    checks.push({ id, status: ok ? "PASS" : "FAIL", message });
  let database: URL | undefined;
  try {
    database = new URL(env.DATABASE_URL || "");
  } catch {}
  check(
    "database",
    !!database &&
      ["postgres:", "postgresql:"].includes(database.protocol) &&
      !!database.hostname &&
      database.pathname.length > 1,
    "DATABASE_URL must identify a PostgreSQL database",
  );
  check(
    "database-tls",
    !!database &&
      ["require", "verify-ca", "verify-full"].includes(
        database.searchParams.get("sslmode") || "",
      ),
    "Database connection must explicitly require TLS (sslmode=require or verify-full)",
  );
  let web: URL | undefined;
  try {
    web = new URL(env.WEB_ORIGIN || "");
  } catch {}
  check(
    "https",
    !!web &&
      web.protocol === "https:" &&
      !web.username &&
      !web.password &&
      web.href === `${web.origin}/` &&
      !["localhost", "127.0.0.1", "[::1]"].includes(web.hostname),
    "WEB_ORIGIN must be an HTTPS origin without a path, query, credentials or trailing slash",
  );
  // The origin is compared exactly against browser Origin headers.
  check(
    "origin-format",
    !!web && env.WEB_ORIGIN === web.origin,
    "WEB_ORIGIN must match the browser Origin exactly",
  );
  check(
    "authentication",
    env.AUTH_MODE === "sms" &&
      filled(env.MSG91_AUTH_KEY) &&
      filled(env.MSG91_TEMPLATE_ID),
    "SMS authentication needs MSG91_AUTH_KEY and MSG91_TEMPLATE_ID",
  );
  check(
    "otp-secret",
    filled(env.OTP_HASH_SECRET) &&
      (env.OTP_HASH_SECRET?.length || 0) >= 32 &&
      new Set(env.OTP_HASH_SECRET).size >= 8,
    "OTP_HASH_SECRET must contain at least 32 random characters and no placeholder",
  );
  check(
    "storage",
    env.STORAGE_MODE === "s3" &&
      filled(env.S3_BUCKET) &&
      filled(env.S3_ACCESS_KEY_ID) &&
      filled(env.S3_SECRET_ACCESS_KEY) &&
      filled(env.S3_REGION),
    "Private S3/R2 storage requires bucket, region and access credentials",
  );
  if (env.S3_ENDPOINT) {
    let endpoint: URL | undefined;
    try {
      endpoint = new URL(env.S3_ENDPOINT);
    } catch {}
    check(
      "storage-tls",
      endpoint?.protocol === "https:" &&
        !endpoint.username &&
        !endpoint.password,
      "S3_ENDPOINT must use HTTPS without embedded credentials",
    );
  }
  check(
    "sample-seed",
    env.SEED_SAMPLE_DATA === "false",
    "Set SEED_SAMPLE_DATA=false in production",
  );
  const live = env.NOTIFICATION_MODE === "live";
  check(
    "notification-mode",
    ["live", "local"].includes(env.NOTIFICATION_MODE || "local"),
    "NOTIFICATION_MODE must be live or local",
  );
  if (!live)
    checks.push({
      id: "notifications",
      status: "WARN",
      message:
        "Outbound alerts are disabled; local queue records do not send messages",
    });
  else {
    const topics = [
      "NEW_ARRIVALS",
      "STOCK_ALERTS",
      "INQUIRY_ALERTS",
      "PAYMENT_REMINDERS",
    ];
    const email =
      filled(env.RESEND_API_KEY) &&
      /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(
        env.NOTIFICATION_EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ||
          env.NOTIFICATION_EMAIL_FROM ||
          "",
      );
    const sms =
      filled(env.MSG91_AUTH_KEY) &&
      filled(env.SMS_SENDER_ID) &&
      topics.every((t) => filled(env[`SMS_FLOW_${t}`]));
    const whatsapp =
      filled(env.WHATSAPP_ACCESS_TOKEN) &&
      filled(env.WHATSAPP_PHONE_NUMBER_ID) &&
      /^v\d+\.\d+$/.test(env.WHATSAPP_API_VERSION || "") &&
      topics.every((t) => filled(env[`WHATSAPP_TEMPLATE_${t}`]));
    check(
      "notification-provider",
      email || sms || whatsapp,
      "Live alerts need at least one complete email, SMS or WhatsApp provider configuration",
    );
    for (const [id, enabled, complete] of [
      [
        "email-alerts",
        !!env.RESEND_API_KEY || !!env.NOTIFICATION_EMAIL_FROM,
        email,
      ],
      [
        "sms-alerts",
        !!env.SMS_SENDER_ID || topics.some((t) => !!env[`SMS_FLOW_${t}`]),
        sms,
      ],
      [
        "whatsapp-alerts",
        !!env.WHATSAPP_ACCESS_TOKEN ||
          !!env.WHATSAPP_PHONE_NUMBER_ID ||
          topics.some((t) => !!env[`WHATSAPP_TEMPLATE_${t}`]),
        whatsapp,
      ],
    ] as const)
      if (enabled)
        check(id, complete, `Complete all required settings for ${id}`);
    checks.push({
      id: "delivery-proof",
      status: "WARN",
      message:
        "Configured providers still require an opt-in live delivery test; this check sends nothing",
    });
  }
  return checks;
}

export function assertProductionConfig(env: Env) {
  const failures = productionConfigChecks(env).filter(
    (c) => c.status === "FAIL",
  );
  if (failures.length)
    throw new Error(
      `Production configuration blocked: ${failures.map((c) => c.id).join(", ")}. Run npm run launch:check for details.`,
    );
}

export async function productionDataChecks(
  db: PrismaClient,
  root: string,
): Promise<LaunchCheck[]> {
  const required = (
    await readdir(path.join(root, "packages/db/migrations"), {
      withFileTypes: true,
    })
  )
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const migrations = await db.$queryRaw<
    Array<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>
  >`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
  const applied = new Set(
    migrations.filter((m) => m.finished_at).map((m) => m.migration_name),
  );
  const missing = required.filter((name) => !applied.has(name));
  const failed = migrations.some((m) => !m.finished_at && !m.rolled_back_at);
  const [plans, admins, sampleUsers, sampleBusinesses, encoding] =
    await Promise.all([
      db.plan.count({ where: { active: true } }),
      db.user.count({
        where: { role: "PLATFORM_ADMIN", disabled: false, isSample: false },
      }),
      db.user.count({ where: { isSample: true } }),
      db.business.count({ where: { isSample: true } }),
      db.$queryRaw<
        Array<{ encoding: string }>
      >`SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname=current_database()`,
    ]);
  return [
    {
      id: "migrations",
      status: !missing.length && !failed ? "PASS" : "FAIL",
      message:
        !missing.length && !failed
          ? "All repository migrations applied"
          : "Pending or failed migrations; run db:deploy and resolve failures",
    },
    {
      id: "plans",
      status: plans > 0 ? "PASS" : "FAIL",
      message:
        "At least one active subscription plan is required for onboarding",
    },
    {
      id: "administrator",
      status: admins > 0 ? "PASS" : "FAIL",
      message:
        "At least one active, non-demo platform administrator is required",
    },
    {
      id: "demo-data",
      status: !sampleUsers && !sampleBusinesses ? "PASS" : "FAIL",
      message:
        "Production must use a database without sample users or sample businesses",
    },
    {
      id: "utf8",
      status: encoding[0]?.encoding === "UTF8" ? "PASS" : "FAIL",
      message:
        "Database must use UTF8 for multilingual catalog and buyer names",
    },
  ];
}
