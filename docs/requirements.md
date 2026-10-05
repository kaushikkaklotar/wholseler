# Document alignment

Source: Wholesale Commerce System Research Report (11 pages). Phase 1 is a wholesale operating system for catalog, inventory, billing and direct seller sourcing. Phase 2/3 are separate work.

| Requirement                   | Implementation / verification                                                                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Five panels                   | Owner workspace; billing staff with module permissions; seller sourcing; platform admin; operations review/support                                                                                         |
| Mobile OTP and role isolation | Database OTP challenges, one-use expiry, attempt/rate limits, opaque hashed sessions, HttpOnly cookies, server permission guards. Development OTP explicitly local. Production MSG91 credentials required. |
| Multi-tenancy                 | Business context comes from the session. Tenant predicates on all business reads/writes. Cross-tenant invoice/product/stock tests.                                                                         |
| Catalog and variants          | SKU, category, images, size/colour variants, MOQ, unit/carton pricing, public/approved/inquiry pricing, moderation and duplication                                                                         |
| Fast bulk entry               | CSV template, preview and validation, grouped variants, atomic import and subscription cap. Images uploaded separately. XLSX and image ZIP mapping remain future extensions.                               |
| Inventory ledger              | Opening, purchase, billing, stock out, return, cancellation, adjustment. Signed quantities, actor, reason, after-balance and references.                                                                   |
| Counter billing               | Buyer snapshot, GST/non-GST mode, discount, explicit tax rate, manual payment recording, printable invoice and CSV export. Amounts in integer paise.                                                       |
| Atomic billing                | PostgreSQL serializable transaction, conditional stock decrement, bounded conflict retries, idempotent request keys.                                                                                       |
| Returns / cancellation        | Restore only eligible quantities, preserve immutable sales snapshots, ledger entries, due/credit reporting. No payment gateway or automatic refund.                                                        |
| Seller discovery              | PostgreSQL search, category/location/stock/price filters, new/trending ordering, favorites, live variants and supplier profiles                                                                            |
| Direct sourcing               | Call/WhatsApp links prepared after recording the inquiry. User sends the message. Inquiry stages, quantity notes, invoice conversion and buyer history.                                                    |
| Staff caps / permissions      | Serializable cap enforcement, presets, module/action matrix, live permission changes, disabled-session invalidation                                                                                        |
| Platform workflow             | Business/seller approvals and suspension; product moderation; configurable plans; onboarding notes; support ticket replies; audit trail                                                                    |
| Reports                       | Daily/monthly net invoice sales, top products, stock movements, low stock, inquiry counts and staff billing                                                                                                |
| Notifications                 | Persistent in-app inquiry, verification, low stock and support notifications. Outbound promotional/reminder delivery is not enabled.                                                                       |
| Optional KYC                  | Private document uploads and verification review. GSTIN format validation; no external legal identity verification claim.                                                                                  |
| Storage                       | Local files for development; private S3/R2 adapter required for production. Sample product illustrations are clearly sample assets.                                                                        |

All plans retain inventory and billing. Starter defaults: ₹999 / month, 3 staff; Growth: ₹1,999; Pro: ₹3,499. Growth/Pro staff/product caps are configurable product defaults, not fixed values prescribed by the report.

Launch requires real supplier data, SMS/DLT credentials, S3/R2, managed PostgreSQL and backups, HTTPS deployment, operational moderation and tax/accounting review. Passing local workflow tests is a development milestone, not evidence of a completed commercial launch.

Phase 2 payroll, attendance, salary, credit reminder automation, Telegram import, disputes and Phase 3 Tally/Zoho/AI/logistics integrations are not represented as working integrations.
