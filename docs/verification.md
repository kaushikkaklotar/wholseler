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
