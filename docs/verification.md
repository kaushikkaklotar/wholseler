# Phase 1 verification — 6 October 2026

## Automated checks

Typecheck, lint, ten unit tests, optimized build and both PostgreSQL integration suites passed on the development release. Integration checks were repeated on the original laptop project after the database upgrade and migrations.

The Phase 1 suite verifies concurrent holds versus sales, insufficient unreserved stock, wrong-buyer and cross-business holds, expiry, exact retry payloads, hold consumption, return/cancel restoration and reserved ledger snapshots; atomic stock/catalog batches and retry deduplication; expiry/renewal and preserved collection snapshots; assigned onboarding tasks and READY prerequisites; follows, new publication deduplication, manual reminders, opt-in delivery and daily category search deduplication. A Hindi product name and rupee message exercise UTF-8 storage.

## Browser checks

Browser checks ran against an isolated seeded laptop database on ports 3100/3101. Development OTPs were used; no external SMS/email/WhatsApp was sent.

| Panel | Desktop / mobile checks |
| --- | --- |
| Owner | OTP sign-in, product catalog, inventory, subscription, notification settings |
| Staff | OTP sign-in, billing and notifications; admin workspace denied |
| Buyer | OTP sign-in, discovery, saved suppliers, profile and notifications |
| Admin | OTP sign-in, business approvals and plan management |
| Operations | OTP sign-in and onboarding workspace |

Desktop width 1440 and mobile width 390 were checked for meaningful content, browser errors, framework overlays and document overflow. Screenshots of public entry and buyer/admin mobile views were visually inspected. Wide data tables retain their own scrolling area.

Real browser file uploads imported an XLSX with two variants grouped into one SKU plus one WebP image from a ZIP. The resulting product had 20 opening units and entered moderation. A stock XLSX previewed M 12→17 and L 8→11, then saved two ledger entries. A four-unit buyer hold reduced M availability from 17 to 13; its billing link preserved buyer/SKU, selected the full held quantity and issued a ₹3,000 invoice. The hold became CONSUMED and physical stock became 13, with zero reserved.

## Local data preservation

The original Windows development database was WIN1252. A PostgreSQL 18 custom-format UTF-8 dump and environment backup were saved in `.data/backups`; restoration into a new UTF-8 database was checked by comparing all 25 original public table row counts. The original database was retained. New local clusters initialize with UTF-8.

## Limits of this evidence

Outbound delivery tests use a mocked provider and verify queue behavior only. Real providers, approved templates, private cloud storage, HTTPS hosting, scheduled backup/restore operations and the report's real-world pilot remain launch work. ACCEPTED is provider acknowledgement, not delivery confirmation.

Sharp was updated to 0.35.5 for image-processing advisories. The dependency audit still flags the Prisma configuration toolchain's deepmerge-ts recursive-object issue; this release does not pass untrusted configuration objects into that toolchain. Review the tooling dependency before production release; no forced major-version migration was applied.

The report's recommended Pro multi-godown/promotion credits/priority-support benefits remain unimplemented and are not sold by the current plan UI. See requirements.md for the complete scope boundary.
## 7 October 2026 — launch preparation verification

The follow-up adds production-only provisioning (plans/admin without demo data), startup/readiness guards, exported-snapshot backup and restore rehearsal tools, a container configuration and GitHub Actions checks. These are launch prerequisites, not evidence of live external provider delivery.

- Cloud typecheck (including operational scripts), lint, 12 unit tests and production build passed. Production startup rejected the development configuration before opening the API.
- After laptop reconnection, the clean review worktree was advanced from `16f577b` to `7d20a48`. Its `test:launch` suite passed against randomly named databases: fresh provisioning, preserved plan pricing, refusal to promote an owner, sample-data rejection, owner onboarding, Gujarati/Hindi product names and stock restore, rejection of an existing recovery target and corrupt backup. Only the suite's databases were removed.
- Billing and Phase 1 PostgreSQL integration suites also passed on that review revision. The chained native typecheck/unit/build process was started, but its final result could not be retrieved after the remote connection timed out.
- A further recovery fix compares table counts independently of JSON field order and adds a reordered-sidecar / post-backup-source-write regression. Operational typecheck passed in the cloud; this extended database regression still needs to run on the laptop or CI.
- Docker Desktop reported that its engine was not running. A bounded `docker desktop start --timeout 60` attempt was made; subsequent device requests timed out with HTTP 504. Container build/runtime verification remains unconfirmed. Do not retry starting Docker locally during connection recovery; use CI for the container build if necessary.
- The original Windows main was last verified clean at `16f577b`. No main fast-forward or GitHub push of the launch changes was performed. The original database was started without replacing it. Changes are committed in the working checkout and preserved as an incremental Git bundle.

### Laptop reconnection and consolidation

The original `E:\Kaushik\wholseler` main was subsequently advanced cleanly to `cd992b4`. Its extended `test:launch` suite passed against PostgreSQL 18, including the reordered JSON sidecar and snapshot isolation regression: restored stock remained 20 while the source had advanced to 23. Operational/application typecheck and the optimized production build also completed successfully on the original laptop folder.

Both review revisions were ancestors of the final main and their tracked trees were clean. Their local data and settings were preserved inside the final folder's `.data/retired-worktree-data` before removing the duplicate worktrees. The original running PostgreSQL cluster and environment were retained.

Container build/runtime verification, production provider credentials, HTTPS deployment, off-host backup scheduling and real pilot acceptance remain required; see [production.md](production.md).

## 7 October 2026 — Surat directory and system regression checks

The original final folder is `E:\Kaushik\wholseler`. Revision `9e72f19` was applied there and its supplier-directory migration and import completed against the original UTF-8 database. Eight public business contacts were imported with source URLs and checked dates. No supplier user accounts, products, prices or stock were manufactured. Backups before and after the migration completed; the latter exercised the repaired `PG_BIN` environment setting.

The system's independent QA database passed application/operations typechecks, lint, 13 unit tests, all three PostgreSQL integration suites and optimized API/web builds. New regressions verify import idempotency, preservation of inactive listings, no user creation from listings, sample/disabled-owner exclusion, concurrent staff caps, permission escalation rejection, immediate disabled-session revocation and expired-subscription reactivation rejection. The launch suite also verifies the environment-only PostgreSQL tools setting.

Browser checks used this isolated database and local OTPs. The homepage showed all eight sourced suppliers with correct telephone/source/website links; marketplace search for Durga returned only Durga Sarees. Wholesaler registration, all three onboarding steps and product creation with 20 opening units passed. A four-unit ₹2,000 invoice, ₹1,000 payment and one-unit ₹500 return left ₹500 due. Cancelling restored stock to 20; a second one-unit paid invoice was issued through the mobile UI. Mobile views at width 390 had no document overflow; screenshots of the public page and return dialog were inspected. Below-fold controls needed an explicit scroll before the automation click; a subsequent normal click issued the second invoice. No external supplier calls or messages were sent.

During the final buyer registration check, desktop command responses stopped; a follow-up returned HTTP 504 even though device inventory still listed the system online. Buyer-directory verification, stopping the isolated QA server, restarting the normal app, and pushing these revisions are unconfirmed. The normal `.env` was not changed. The isolated server may still be running on ports 3000/3001; it must be stopped before the normal app starts. Do not drop the original database or stop its PostgreSQL server.

A final URL validation regression makes malformed directory URLs return validation errors rather than throwing from `new URL`. Cloud unit and operations checks cover this fix.

### System reconnection — 7 October, afternoon

The connection recovered. The final URL validation fix was applied in the original folder and all 13 native unit tests passed. The isolated QA server was stopped and only `qa_flow_20261007_fe0efc8a91` was removed. The original PostgreSQL server and `.env` were retained. The normal development app was restarted on ports 3000/3001; its API confirmed eight supplier listings and development OTP mode. The `23acd7b` code release was pushed, and GitHub main and the local tracking branch were verified against that commit.

The buyer account was then signed in with a local OTP in the isolated browser test session against the original database. `/seller/suppliers` displayed all eight directory businesses with telephone, website and source links. Chrome was launched with six requested tabs for the public website, owner, staff billing, buyer, admin and operations. These tabs share the normal browser profile's session; switch roles by signing out, or use separate profiles when simultaneous roles are needed.

## 7 October 2026 — catalog comparisons and Operations members

The final Windows folder received the catalog-history migration after a PostgreSQL snapshot backup. The original environment and business/product approvals were retained. Separate database `qa_flow_20261007_657338d320` supplied all fictional accounts, products and photos for these checks.

Application and operations typechecks, lint, all 15 unit tests, all four PostgreSQL suites (`test:integration`, `test:phase1`, `test:review`, `test:launch`) and optimized API/web builds passed on the system. The new suite checks exact and cumulative comparisons, unchanged-save preservation, retained image references, stale-review rejection, stock and image ownership guards, Operations provisioning/OTP/task assignment, disabled sessions, mobile collisions and role escalation rejection. CI now includes this suite.

Browser verification followed Admin → Platform Team → Add Operations Member → name/mobile → Create; edit, disable confirmation and enable also saved successfully. The new member appeared in Business approvals → Review → Setup tasks and received an onboarding task. Mobile OTP signed the member into Operations. Operations could inspect revision history while both team management and approval PATCH requests returned HTTP 403. After disabling, the old Operations session returned HTTP 401; the open task remained assigned.

An owner saved an approved product unchanged; it stayed Approved with the unchanged-approval toast. Uploading five actual WebP files and changing ₹500 to ₹600 produced Pending revision 2. Admin saw both photo sets, five Added badges, the 1→6 count, old/new prices, actor/time and history without broken images. A further edit while the review was open caused HTTP 409 and disabled approval until the latest comparison was loaded. Approval of the current version then succeeded. Operations displayed the same history without a Save review action.

Desktop and 390px mobile screens were inspected. A mobile dialog overflow discovered during inspection was fixed; the dialog's scroll width then equalled its 341px client width, including an expanded five-photo history comparison, with no document overflow. Wide comparison tables scroll within their own container. Browser page-error checks were empty. Existing submissions have no recoverable before-snapshot; reviewers see their current details and future edits create history.
