# Surat supplier directory

Eight businesses were researched on their own websites on 7 October 2026: Amrah Wholesale, Durga Sarees, Lakhani Cottons, M.R. Textile, Sai Satguru Textile, Surat Wholesale Shop, Suratfabric.com and Textile Zone. Each record in `packages/db/data/surat-suppliers.json` contains the source URL, checked date, public business phone, address and supported categories. Email is left empty where it was not confirmed.

These are public contact listings. Importing them does not create user accounts, confer KYC approval, or create products, prices, stock, ratings or orders. Buyers can call or visit the supplier's website to confirm current commercial terms. Registered platform businesses and their moderation process remain separate.

## Import and updates

After applying migrations, run `npm run directory:import` against the intended database. Take a backup before importing into an existing database. The importer validates the entire dataset before its transaction, requires HTTPS source URLs on the supplier's own website, and rejects extra fields such as invented stock or verification status.

Stable listing IDs make repeated imports update the same records. A manually deactivated listing stays inactive when imported again. Amend factual fields and the checked date only after rechecking the source. `GET /v1/marketplace/suppliers` exposes active listings with name/category/city filters; the homepage, marketplace and buyer supplier page display the directory.

Sample and disabled-owner accounts are excluded from public product discovery and registered supplier results. Development login helpers and private sample data are retained for local testing; they are not genuine commercial listings.
