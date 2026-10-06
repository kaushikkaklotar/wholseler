# Phase 1 document alignment

Source: Wholesale Commerce System Research Report (11 pages). Phase 1 is the internal wholesale operating system plus direct buyer sourcing; online checkout is not required.

| Report requirement | Implemented behavior |
| --- | --- |
| Five panels | Owner, permission-limited staff, buyer/seller, platform admin and operations |
| Public website and login | Public catalog; separate wholesaler/buyer login and explicit registration, one-use mobile OTP, resend cooldown and three-step onboarding |
| Catalog | SKU, categories, size/colour, MOQ, unit/carton price, visibility, images, duplication and moderation |
| Fast bulk entry | CSV/XLSX first-sheet preview, grouped variants, image file/ZIP mapping by filename or SKU, atomic retry-safe catalog import; 500 rows and 200 ZIP images per batch |
| Stock | Physical, reserved and available balances; opening/in/out/sale/return/adjustment ledger; buyer holds with expiry, release and billing consumption; retry-safe CSV/XLSX stock preview/import |
| Counter billing | GST/non-GST, integer-paise totals, buyer snapshots, discounts, payments, print/CSV, atomic concurrent stock guards, idempotency, returns/cancel |
| Buyer discovery | Search, category/city/market/stock/price filters, new/trending, product and supplier favorites, available variants, saved supplier arrivals |
| Category ranking | Daily distinct buyer category searches, views, recent incoming movement and billed quantities feed weighted category/trending scores; this is an observed activity score |
| Direct contact | Supplier CALL/WHATSAPP/BOTH preference, recorded inquiries and stages, buyer history and invoice conversion; the user opens/sends the prepared WhatsApp message |
| Onboarding/KYC | Business/buyer profiles, marketplace channels, optional GST/PAN and private documents, verification/suspension, product review; no automated legal identity verification |
| Staff | Live permission matrix, active staff caps, disabled session invalidation and tenant isolation |
| Subscription | Start/expiry/trial status; monthly/yearly terms, received-payment records and request-key-safe renewals; caps and expiry enforced on server; records accessible after expiry |
| Operations | Assigned onboarding tasks, categories, due dates, notes and stages; READY requires verified business, published catalog with image and completed tasks |
| Alerts | In-app notices; consent-based new arrival, stock, inquiry status and manually triggered unpaid-invoice reminders; persistent email/SMS/WhatsApp outbox and honest configured/failed/unknown/accepted states |
| Reports/support | Daily/monthly sales, products, stock, staff and inquiry reports; support tickets, replies and audits |
| Storage | Development uploads; private S3/R2 adapter for production |

Starter defaults ₹999/month or ₹9,999/year with 3 staff; Growth ₹1,999/₹19,999; Pro ₹3,499/₹34,999. Staff/product limits beyond Starter are configurable product defaults. All plans include stock and billing. Growth/Pro include bulk imports and advanced reports.

The report's pricing recommendations also mention future Pro multi-godown, promotion credits and priority support. Those benefits are **not implemented or advertised as available** in this Phase 1 release; separate commercial scope is needed before selling them. Phase 2 accountant/credit limits and automatic due-date reminders, payroll, Telegram import/reviews/disputes/SEO and Phase 3 accounting/marketplace/AI/logistics remain later phases.

## Verification and launch

`npm test` covers money/schema/auth entry and subscription calendar boundaries. `npm run test:integration` checks billing/auth/tenant boundaries. `npm run test:phase1` creates isolated fixtures for reservations vs billing races, retries and expiry, stock/catalog batches, cross-tenant access, renewal enforcement, onboarding tasks, supplier follows, publication alerts, payment reminders, provider queue states and search ranking. Provider calls in this suite are mocked; they do not establish live message delivery.

Before public launch:

- Configure and test real OTP/DLT, approved WhatsApp/SMS templates, opt-in recipients, email sender and private S3/R2.
- Deploy managed PostgreSQL and HTTPS services; schedule backups and demonstrate restore. Use production administrator provisioning, not sample accounts.
- Perform owner/staff/buyer/admin/operations acceptance with real supplier catalog and review invoice/tax settings.
- Complete the report's pilot validation: 20 wholesalers and 50 sellers, then track the 30 active wholesaler / 10,000 product / 500 buyer usage goals. These real-world milestones cannot be replaced by automated development tests.
