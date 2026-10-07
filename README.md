# Wholseler

A document aligned B2B wholesale operating system for textile and apparel markets. It connects catalog, live inventory, counter billing, seller sourcing and platform operations in one multi tenant application.

## Phase 1 implementation

- Public marketplace homepage, product search and detail pages; only approved products from verified businesses are published
- Separate wholesaler and buyer registration/sign-in, team sign-in, mobile OTP with resend cooldown, and three-step onboarding
- Five workspaces: wholesaler owner, staff, seller (buyer/retailer), platform admin and platform operations
- OTP authentication, server enforced roles and module permissions
- Product catalog with variants, MOQ, pricing visibility, photos, moderation, duplication and Excel/CSV import with image ZIP mapping
- Buyer stock holds with expiry, consumption at billing, available/on-hand/reserved balances and Excel/CSV stock batches
- Signed inventory ledger for opening, purchase, stock out, billing, returns, cancellation and adjustments
- Atomic PostgreSQL billing with stock guards, idempotent requests, buyer snapshots, GST modes, payments, returns and printable invoices
- Seller discovery, favorites, supplier profiles, pricing approval, WhatsApp/call leads and inquiry conversion
- Staff limits, monthly/yearly subscription periods and manual collection receipts, expiry enforcement and renewals
- Saved suppliers, category demand ranking, buyer profiles and optional GST/PAN/KYC
- Configurable plans, approvals, assigned onboarding tasks, audit log, notifications and support tickets
- Opt-in email, SMS and WhatsApp delivery queue for new arrivals, stock/inquiry updates and manual unpaid-invoice reminders
- Daily and monthly reports for sales, products, staff, inquiries and stock movements

The exact report mapping and current limits are in [docs/requirements.md](docs/requirements.md).

The public [Surat supplier directory](docs/supplier-directory.md) contains eight source-backed business contacts. After migrations, run `npm run directory:import` to import or update them. These listings do not invent inventory, prices or verified member accounts. Public discovery excludes sample and disabled-owner accounts.

## Local setup (Windows)

```powershell
Copy-Item .env.example .env
npm install
npm run db:local
```

Keep that terminal running. In a second terminal:

```powershell
npm run setup
npm run dev
```

Open `http://127.0.0.1:3000`. Development mode shows one sample account for every role and exposes the local OTP inside the login screen. It does not send an SMS.

The homepage is public. Wholesalers sign in at `/login/wholesaler` or create an account at `/register/wholesaler`. Buyers use `/login/buyer` and `/register/buyer`. Staff and platform members use `/login/team`. Local demo accounts are under the expandable login section. Signing in no longer creates accounts; registration is explicit. Buyer product references survive sign-in and onboarding.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:phase1
npm run test:launch
npm run build
```

The integration suite uses the configured PostgreSQL database, creates isolated temporary businesses, checks concurrent stock deduction, idempotency and tenant isolation, then removes only its own fixtures.

## Production configuration

Production startup requires PostgreSQL with TLS/certificate validation, exact HTTPS `WEB_ORIGIN`, MSG91 OTP credentials, a strong `OTP_HASH_SECRET`, and S3/R2 private storage. It rejects pending/failed migrations, absent plans/admin, non-UTF8 databases and sample accounts. Initialize plans and the first administrator after migration with:

```powershell
npm run production:bootstrap -- --phone YOUR_ADMIN_MOBILE --name "Platform Admin"
npm run launch:check
```

Launch also needs database backups, real supplier onboarding, DLT/SMS approval, storage credentials, moderation operations and tax/accounting review. Payroll, Telegram import, disputes, Tally/Zoho, AI and logistics integrations remain later phases from the research report.

The container setup, production environment template, provisioning order, safe snapshot backups and restore rehearsals are in [docs/production.md](docs/production.md). Use a fresh production database and do not run the development `setup`/sample seed there. `test:launch` additionally needs matching PostgreSQL tools and CREATE DATABASE privileges; it only changes databases that it creates itself.

## Notifications and subscription operations

Notifications are opt-in per topic and channel on `/notifications`. `NOTIFICATION_MODE=local` records delivery jobs without making provider requests; the UI explicitly shows that delivery is unavailable. For live delivery configure Resend and/or MSG91 approved flows and/or Meta approved WhatsApp templates from `.env.example`, then set `NOTIFICATION_MODE=live`. OTP configuration is separate from notification flows. SMS flows have TITLE, MESSAGE, LINK variables; WhatsApp templates have three body parameters in that order. Verify provider acceptance and actual delivery with a consenting test recipient before launch.

`ACCEPTED` means the provider acknowledged the request, not that a device received it. Known transient failures retry at most three attempts. Timeouts or a worker crash leave `UNKNOWN`: check the provider dashboard before any manual retry, to avoid duplicate messages. Unsubscribed users and unfollowed suppliers are checked again before sending. Payment reminders are requested explicitly from an unpaid invoice; automated credit due-date reminders belong to Phase 2.

Owners view their subscription and collection history at `/dashboard/subscription`. Platform admins record payments already received (monthly/yearly, amount, method and reference). No gateway payment is implied. New businesses receive a 30-day trial; migration gives existing businesses a 30-day grace period. Expiry blocks new bills/catalog/stock/team growth but permits record viewing, existing payment recording, returns/cancellation, settings and stock hold release. Paid renewal extends an existing paid term, or starts now after trial/expiry. Every renewal preserves its original plan/price snapshot.

See [docs/requirements.md](docs/requirements.md) for scope and the launch checklist.

## Local backup and Unicode upgrade

New local databases are initialized with UTF-8. For an existing Windows database created with the old default encoding, stop the app (keep PostgreSQL running), then run `node scripts/local-utf8.mjs --pg-bin "C:/Program Files/PostgreSQL/18/bin"`. The helper writes a custom-format UTF-8 backup and environment backup in `.data/backups`, restores into a new database, compares every public table's row count, and updates `.env` only after successful verification. It retains the original database. Restart the app after `npm run db:deploy`. An already UTF-8 database is backed up without being replaced. This development helper is not a production backup scheduler.
