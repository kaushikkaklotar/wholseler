# Wholseler

A document aligned B2B wholesale operating system for textile and apparel markets. It connects catalog, live inventory, counter billing, seller sourcing and platform operations in one multi tenant application.

## Implemented MVP

- Public marketplace homepage, product search and detail pages; only approved products from verified businesses are published
- Separate wholesaler and buyer registration/sign-in, team sign-in, mobile OTP with resend cooldown, and three-step onboarding
- Five workspaces: wholesaler owner, staff, seller (buyer/retailer), platform admin and platform operations
- OTP authentication, server enforced roles and module permissions
- Product catalog with variants, MOQ, pricing visibility, photos, moderation, duplication and CSV import
- Signed inventory ledger for opening, purchase, stock out, billing, returns, cancellation and adjustments
- Atomic PostgreSQL billing with stock guards, idempotent requests, buyer snapshots, GST modes, payments, returns and printable invoices
- Seller discovery, favorites, supplier profiles, pricing approval, WhatsApp/call leads and inquiry conversion
- Staff limits, configurable plans, KYC files, approvals, audit log, notifications and support tickets
- Daily and monthly reports for sales, products, staff, inquiries and stock movements

The exact report mapping and current limits are in [docs/requirements.md](docs/requirements.md).

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
npm run build
```

The integration suite uses the configured PostgreSQL database, creates isolated temporary businesses, checks concurrent stock deduction, idempotency and tenant isolation, then removes only its own fixtures.

## Production configuration

Production startup requires managed PostgreSQL, HTTPS `WEB_ORIGIN`, MSG91 OTP credentials, a strong `OTP_HASH_SECRET`, and S3/R2 private storage. Create the first administrator after migration with:

```powershell
node scripts/create-admin.mjs --phone 9876543210 --name "Platform Admin"
```

Launch also needs database backups, real supplier onboarding, DLT/SMS approval, storage credentials, moderation operations and tax/accounting review. Payroll, Telegram import, disputes, Tally/Zoho, AI and logistics integrations remain later phases from the research report.
