import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertProductionConfig,
  productionConfigChecks,
} from "../apps/api/src/production";

const configured = {
  DATABASE_URL:
    "postgresql://user:test-password@db.internal/wholesale?sslmode=require&sslaccept=strict",
  WEB_ORIGIN: "https://wholesale.test",
  AUTH_MODE: "sms",
  MSG91_AUTH_KEY: "test-key",
  MSG91_TEMPLATE_ID: "test-template",
  OTP_HASH_SECRET: "a1b2c3d4e5f6g7h8i9j0kLmNOpQrStUv",
  STORAGE_MODE: "s3",
  S3_BUCKET: "test-private",
  S3_REGION: "auto",
  S3_ACCESS_KEY_ID: "test-access",
  S3_SECRET_ACCESS_KEY: "test-secret",
  SEED_SAMPLE_DATA: "false",
  NOTIFICATION_MODE: "local",
};
test("Production rejects development authentication, non-TLS database and sample seeding; diagnostics contain no secrets", () => {
  assert.doesNotThrow(() => assertProductionConfig(configured));
  for (const change of [
    { AUTH_MODE: "development" },
    { DATABASE_URL: "postgresql://u:p@db/wholesale" },
    { DATABASE_URL: "postgresql://u:p@db/wholesale?sslmode=require" },
    { SEED_SAMPLE_DATA: "true" },
    { WEB_ORIGIN: "https://wholesale.test/" },
    { WEB_ORIGIN: "https://wholesale.test/path" },
    { OTP_HASH_SECRET: "replace-with-at-least-32-random-characters" },
    { S3_ENDPOINT: "http://storage.test" },
  ]) {
    assert.throws(() => assertProductionConfig({ ...configured, ...change }));
  }
  const diagnostic = JSON.stringify(productionConfigChecks(configured));
  for (const secret of [
    configured.OTP_HASH_SECRET,
    configured.S3_SECRET_ACCESS_KEY,
    "test-password",
    configured.MSG91_AUTH_KEY,
  ])
    assert.ok(!diagnostic.includes(secret));
});
test("Live notification mode requires a complete provider; OTP credentials alone do not configure SMS alerts", () => {
  const live = { ...configured, NOTIFICATION_MODE: "live" };
  assert.throws(() => assertProductionConfig(live));
  assert.doesNotThrow(() =>
    assertProductionConfig({
      ...live,
      RESEND_API_KEY: "test-resend",
      NOTIFICATION_EMAIL_FROM: "Wholesale <alerts@wholesale.test>",
    }),
  );
  assert.throws(() =>
    assertProductionConfig({
      ...live,
      RESEND_API_KEY: "test-resend",
      NOTIFICATION_EMAIL_FROM: "alerts@wholesale.test",
      WHATSAPP_ACCESS_TOKEN: "partial",
    }),
  );
  assert.ok(
    productionConfigChecks(configured).some(
      (c) => c.id === "notifications" && c.status === "WARN",
    ),
  );
});
