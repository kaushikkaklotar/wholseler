# Production launch and recovery

Phase 1 has a separate production bootstrap. Do not run `npm run setup` on a live database: that command intentionally includes development sample seeding. Plans are the prerequisite for wholesaler onboarding; categories are strings in profiles/catalog, not a separately seeded table.

## Provision a fresh deployment

Use Node 24, PostgreSQL 18, a private S3/R2 bucket and a persistent application service. Reservation expiry and notification delivery run inside the API process; this deployment is a single always-running application instance, not a static export or an API that sleeps between requests. Do not scale to multiple instances until distributed authentication rate limiting is implemented.

1. Copy `.env.production.example` to `.env.production` on the deployment machine. Fill the database, public HTTPS origin, OTP and private storage settings. Generate the OTP secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep credentials out of git and build arguments.
2. Use a direct PostgreSQL connection for migrations, backup and recovery. Require `sslmode=require&sslaccept=strict`; configure the provider's CA certificate using an absolute `sslrootcert`/`sslcert` path when necessary and mount it into the container. Do not point backup tools at a transaction pooler: the exported snapshot needs a persistent session.
3. From the repository root, build and provision:

```sh
docker compose -f deploy/compose.yaml build
docker compose -f deploy/compose.yaml run --rm app npm run db:deploy
docker compose -f deploy/compose.yaml run --rm app npm run production:bootstrap -- --phone YOUR_ADMIN_MOBILE --name "Platform Admin"
docker compose -f deploy/compose.yaml run --rm app npm run launch:check
docker compose -f deploy/compose.yaml up -d app
```

Replace `YOUR_ADMIN_MOBILE` with the real administrator's Indian mobile number. Bootstrap creates Starter/Growth/Pro defaults and a non-demo administrator. Rerunning preserves edited plans and an existing active administrator; it refuses to promote an existing owner, buyer, staff member, disabled user or sample account. Omit both phone/name to initialize only plans when an administrator already exists. This creates no sample catalog, invoices, staff or buyers.

The container runs as a non-root user, publishes only web port 3000 to host loopback, and keeps the API on container loopback. Health checks traverse Next's `/api/v1/health` rewrite and query PostgreSQL. The supervisor terminates both services if either exits and allows up to 25 seconds for production shutdown. Compose allows 30 seconds before its own forced stop. Application logs are available with `docker compose -f deploy/compose.yaml logs --tail 100 app`.

Put an HTTPS reverse proxy or managed HTTPS gateway in front of host `127.0.0.1:3000`. Set `WEB_ORIGIN` to the exact origin, with no path or trailing slash. Preserve browser Origin and cookies, forward the client address using a header set by the trusted edge (discard client-supplied forwarding headers), allow at least 10 MB per image upload, and set reasonable request/time limits. Verify separate clients are not sharing one authentication throttle. Never publish API port 3001. Next's API rewrite is fixed to `127.0.0.1:3001` at image build; deployment uses those ports deliberately.

## Readiness evidence

`npm run launch:check` reports PASS/FAIL/WARN without printing credential values or sending any message. It checks TLS with certificate validation, exact HTTPS origin, OTP/storage configuration, sample-seed disablement, complete enabled notification providers, applied migrations, UTF8, active plans, an active non-demo administrator and absence of sample users/businesses. `-- --offline` skips database checks; a configuration pass in that mode is not launch approval.

Production API startup enforces the configuration and database checks. A development database containing demo accounts is deliberately rejected even if production credentials are supplied. Use a fresh production database; no automatic deletion of demo data is performed. Empty but provisioned production data is valid: real catalog arrives through onboarding.

The check proves settings and database prerequisites, not external delivery or private bucket permissions. Before launch, collect these acceptance results:

| Flow | Evidence required |
| --- | --- |
| HTTPS / OTP | A real consenting owner's registration, SMS receipt, OTP sign-in and secure session cookie |
| Storage | Real photo upload/read; another business cannot read private KYC; public catalog cannot expose KYC |
| Notifications | Opt-in recipient receives each enabled channel's approved template; provider acknowledgement alone is insufficient |
| Wholesale work | Real catalog import, holds, counter bill, payment, partial return, ledger and printed invoice reviewed by operator |
| Roles | Owner/staff/buyer/admin/operations acceptance and staff permission boundaries |
| Recovery | Off-host backup downloaded and restored; business, invoice, stock and uploaded objects checked |

Keep `NOTIFICATION_MODE=local` until sender/template tests pass. This mode records jobs without sending; the readiness check shows a warning. Enabling live mode requires at least one complete provider and rejects partial configurations for other enabled channels. Existing jobs recorded as NOT_CONFIGURED are not silently replayed when credentials are added. Create new consenting test events instead.

## Scheduled database backup

Install matching PostgreSQL 18 `pg_dump` and `pg_restore` on the operations machine and install the project's locked Node dependencies. Supply the direct connection through a protected environment or `.env`; do not put passwords on a command line. The production app image intentionally does not contain PostgreSQL tools.

```powershell
npm run db:backup -- --pg-bin "C:/Program Files/PostgreSQL/18/bin"
```

On Linux with PostgreSQL tools in PATH:

```sh
npm run db:backup -- --out-dir /secure/backups/wholseler
```

The helper uses one exported repeatable-read snapshot for the custom-format UTF8 dump and exact counts of all public tables. It validates the archive listing and saves `.dump.json` with SHA-256, counts and creation time. Credentials are supplied to PostgreSQL tools through environment variables. Unique filenames preserve older backups; interrupted files retain `.incomplete` and must not be treated as complete backups. These tools cap a backup transaction at 30 minutes; larger databases need managed backup/PITR policies.

Schedule the command daily using the deployment host's scheduler or managed backup service; alert on a nonzero exit. Copy each successful `.dump` and `.dump.json` to encrypted off-host storage and monitor age, retention and restore tests. A successful file on the application's disk is not a durable recovery strategy. The helper does not install a scheduler, upload backups, delete old backups or claim an off-host copy was made. Configure object storage versioning/backup separately: the database dump contains media references, not S3/R2 image bytes.

## Restore rehearsal

Use only trusted backups produced by your operations team. Keep the archive and sidecar together. The configured database role must be allowed to create a database on the recovery cluster; otherwise an operator must use the provider's recovery procedure.

```powershell
npm run db:restore-check -- --archive ".data/backups/wholseler-TIMESTAMP.dump" --target-name wholseler_restore_20261007 --pg-bin "C:/Program Files/PostgreSQL/18/bin"
```

Checksum/manifest validation happens before database creation. The target must be new, with a safe name, and may never be the current application database. Restore is a single transaction and public table counts must match the saved snapshot. An existing target is never overwritten. The helper retains the new database for operator inspection and never changes `.env` or the application's connection. If a restore fails after target creation, that target remains for inspection; use a different new name for the next rehearsal.

For actual incident recovery, stop writes, restore to a new database, verify business/invoice/stock and media objects, then deliberately change the deployment connection and restart services. Retain the old database for rollback. Neither helper switches production traffic automatically.

## Regression checks

GitHub Actions runs typecheck, lint, unit tests, billing/Phase 1 database tests, launch recovery tests and a container build on main/PRs. `npm run test:launch` requires a database role with CREATE DATABASE and matching PostgreSQL tools; it creates randomly named test/recovery databases, checks provisioning and UTF8 restore, then removes only those databases. Backups from the test remain in ignored `.data/launch-tests`.

Official references used for this setup: [Next self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Prisma 6 PostgreSQL TLS options](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql), [PostgreSQL snapshot backups](https://www.postgresql.org/docs/18/app-pgdump.html), [single-transaction restore](https://www.postgresql.org/docs/18/app-pgrestore.html).
