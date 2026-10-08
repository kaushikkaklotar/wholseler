# BulkSaathi UI refresh

Verified on 8 October 2026. This update changes branding and presentation across the public marketplace, registration/login, wholesaler owner, shop staff, buyer, administrator and Operations workspaces.

## Branding and shared UI

- The approved BulkSaathi artwork is in `apps/web/public/brand`. The shared `Brand` component supplies the horizontal logo or compact mark. Browser and Apple icons and the web manifest use the same brand.
- Page titles, public copy, invoice attribution and downloadable template filenames now use BulkSaathi. Existing package names, role identifiers, repository/folder names and database configuration remain compatible with the existing installation.
- Shared colors, spacing, controls, table headers, sidebar navigation, dialogs, metrics and typography live in `apps/web/src/app/globals.css`. Navy text, teal actions, white surfaces and restrained borders are used consistently.
- SVG chart colors use matching literal values in `sales-chart-renderer.tsx`; using CSS variable attributes failed to paint the sales curve on the first browser render during verification.
- Product, invoice, stock, inquiry, approval, subscription, OTP and permission business logic and API endpoints were not changed. Buyers continue to use the platform without a subscription.

## Searchable selects

All 33 native select fields use React Select 5.10.2 through `apps/web/src/components/ui/search-select.tsx`. Existing option values, controlled values, change handlers, required/disabled states and permission conditions are preserved. Options inside fragments, including numeric report periods, work through the same adapter.

The shared select supports typing to filter, arrow-key navigation, Enter selection, Escape dismissal, empty-result messages and an explicit accessible input label. Selecting an option closes the menu. Menus stay inside the form/dialog so Radix focus handling remains intact.

For screen-specific customization, use `placeholder`, `searchPlaceholder`, `noOptionsMessage`, `isClearable`, `className`, root `style`, and React Select's `styles` configuration. Theme variables such as `--primary`, `--border`, `--control-height` and `--ring-soft` can be scoped to the wrapper through a class or root style. Appearance rules use the `.bulk-select__*` prefix and `.bulk-select-control` / `.bulk-select-option` state classes in the shared stylesheet. The `Field` component connects labels to the input without wrapping the menu in a label.

## Verification

- Root type checking, ESLint and all 15 existing unit tests pass.
- Shared and API builds pass; the optimized Next.js web build passes. An old local Next.js cache had to be moved aside before the final clean build.
- Browser checks cover 7 public routes and 25 authenticated routes, at desktop 1440px and mobile 390px widths, without page-level horizontal overflow.
- Search filtering, keyboard selection, no matching results and Escape preserving the current selection were checked on the marketplace.
- Product creation through the searchable category and price-visibility fields saves the expected category, visibility and price payload.
- Catalog review preserves the required decision state, searchable options and saved review decision, including use inside the mobile dialog.
- Admin creation of an Operations member and the active/disabled member filter work.
- The production web build was opened in Chromium. Actual browser OTP sign-in, billing payment-mode behavior, numeric report-period selection, dashboard chart rendering and logo/product-image loading pass. The final browser run reported no page errors.
- After the chart paint fix, fresh desktop and mobile page loads were checked against screenshot pixels to confirm the sales line is visible, not just present in the SVG DOM.

Browser write checks used an isolated, seeded PGlite PostgreSQL-compatible test database and the existing API. Test-only database/browser dependencies and fixtures remain under ignored `.data`, outside product dependencies. PGlite does not provide `pg_trgm`; its extension/index statements were omitted only in the disposable test harness. Production migrations were not edited. These checks do not replace the native PostgreSQL concurrency/integration suites, which were not rerun for this UI update.

The connected Windows system was offline during the initial isolated verification. The completed UI archive was subsequently imported and verified on the connected system as described below.

## Previews

- [Marketplace](ui/marketplace.png)
- [Wholesaler login](ui/wholesaler-login.png)
- [Owner dashboard](ui/owner-dashboard.png)

The dashboard preview uses the explicitly marked sample workspace in the isolated test database. Public supplier cards use the repository's existing source-backed Surat directory; the UI update does not add fabricated live inventory or prices.

## Windows synchronization verification

On 8 October 2026, the archive for UI commit `d7f7599997b4764cc24cd15e6b320edc5ad628af` was validated and applied to `E:\Kaushik\wholseler`. The change set contains 45 UI, branding, dependency and documentation files. The existing environment, PostgreSQL database and uploaded media were retained.

A clean dependency install, Prisma client generation, root type checking, ESLint, all 15 unit tests and the complete shared/API/web production build pass on Windows with Node 22.13.1. The existing local PostgreSQL instance and development app run at their original configured ports. No migrations, sample seed or business-data replacement were run.

Actual installed Chrome checks pass for the seven public pages and 25 authenticated routes at desktop and mobile widths across Owner, Staff, Buyer, Admin and Operations. Verification includes browser OTP sign-in, brand assets, searchable/keyboard-selectable dropdowns, no-result and Escape behavior, the mobile product dialog, sales chart SVG and billing payment-mode behavior. No browser page errors were observed. These native UI checks do not claim a rerun of the separate backend concurrency/integration suites.
