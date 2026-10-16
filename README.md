# PLUG BHAI

A private, functional commerce implementation for review, using the supplied PLÜG BHAI gold wordmark and a black/olive, ivory and champagne palette. This is **not certified production-ready**, and does not implement every advanced feature in the original brief. The differences and launch blockers are listed below so they cannot be mistaken for working integrations.

## Architecture

- React + TypeScript, Next.js-compatible App Router through Vinext.
- Cloudflare Worker server routes, D1 persistent SQL, Drizzle schema/migrations.
- R2 persistent product-image storage; only PNG/JPEG/WebP accepted after byte-signature checks, 5 MB maximum.
- Platform-managed ChatGPT authentication and server-side staff roles. No app-managed passwords.
- Integer paisa throughout; PKR presentation. Order timestamps display in Asia/Karachi.
- SQL batch transactions, stock checks enforced by atomic updates, assertion rows and nonnegative constraints, immutable order item snapshots, unique checkout idempotency keys.
- Catalog, orders, settings, pages, customers, staff and uploads persist independently of application deployments. Browser storage is only the guest bag/wishlist cache; signed-in bags/wishlists also persist in SQL.

## First use

1. Open the private Site, then `/admin`.
2. Sign in with the Site owner's ChatGPT account and choose **Set up my owner account**. The first claim is protected by private Site access and a unique single-owner index.
3. `BOOTSTRAP_ENABLED=true` is temporarily configured for the initial private deployment. The first storefront load inserts explicitly marked demo products and starter pages into SQL once. It does not recreate them after removal.
4. After the owner claim, set `BOOTSTRAP_ENABLED=false` in the Site runtime environment and deploy again **before changing the Site audience**. Do not expose an unclaimed bootstrap endpoint publicly.
5. Set contact information, store address/hours, shipping amount and threshold, optional bank instructions, navigation and homepage settings.
6. Replace all demo products, prices and compatibility details. Use Overview → Archive demo products to remove the demonstration catalog from sale while preserving history.
7. Review and publish actual business policies. Current shipping/returns/privacy/terms text explicitly identifies itself as draft.

Staff sign in and copy their site-specific account ID from `/account`. The owner adds that exact ID and its email under Staff & permissions. Site access and application staff roles are separate; do not change the Site audience merely to grant a role.

## Working flows

- Responsive home, shop, category filtering, search, offers, product pages, image galleries, variants, wishlist, cart, guest checkout, confirmation, private order tracking, signed-in order history, contact, store information and database-backed informational pages.
- Editable products, drafts/publishing/archiving, unique SKUs/slugs, price and cost restrictions, stock thresholds, attributes, multiple stored images, duplication, CSV import/export, bulk archive.
- Variant stock and SKU tracking. Inventory adjustments/history. Order stock reservation and cancellation/return restocking.
- Server-priced COD checkout, coupon validation, shipping threshold, optional configurable tax basis points, bank transfers awaiting manual verification.
- Order statuses, transition validation, customer-visible status notes, manual courier/tracking links, COD collected amounts, owner/manager payment verification, printable order summary/invoice information.
- Customer records with order counts/spending for signed-in customers, notes, tags and marketing consent; support cases, reminders and statuses.
- Percentage/fixed/free-shipping coupons, minimum purchase, expiration, usage limits.
- Plain-text pages with drafts, publishing, slugs and SEO description fields; editable hero content, section ordering, menus and footer links. Content is escaped by React rather than rendered as arbitrary HTML.
- Product reviews with moderation and verified-delivered-purchase badges. No fabricated ratings or reviews.
- CSV exports, search, sortable tables, client pagination over the latest 500 records, audit records for successful sensitive mutations.
- Roles: owner, manager, orders, inventory, support, analyst. Every admin API branch checks permissions on the server. Inventory staff cannot read purchase costs. Customer APIs never return cost.
- Same-origin mutation checks, request validation, rate limiting, private guest order tokens, and platform authentication.

## Local development

Use Node 24 or newer for the SQLite integration-test runner (the app runtime supports the starter's Node requirement). Install the locked dependencies with `pnpm install --frozen-lockfile`. A fresh portable checkout uses the starter's runtime tooling; `scripts/run-framework.mjs` drives Vinext.

```sh
cp .env.example .dev.vars
# Set BOOTSTRAP_ENABLED=true only for private local development.
pnpm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_rapid_gamma_corps.sql
pnpm run dev
```

Apply both SQL migrations in filename order, using the same local command for each filename. Apply a migration only once to each database. Local state is kept in `.wrangler/state`; it is separate from hosted data and must not be committed. In the portable starter, `/signin-with-chatgpt?return_to=/admin` simulates a local identity on loopback. The managed authoring environment does not enable this mock identity. Production must remain behind Sites dispatch; never expose the Worker directly while trusting client-supplied identity headers.

### Schema changes and seed

Edit `db/schema.ts`, then run `pnpm run db:generate`. Review generated SQL and commit it with Drizzle metadata. Applied migrations are immutable; append new migrations. The first migration includes the single-owner unique index. A second migration adds transactional assertion rows used by the order handler. Apply both in order.

Demo seed definitions are in `lib/seed.ts`. Initial seeding is transactional and separate from schema migrations. An owner can also call `POST /api/admin/seed` with `{ "action": "seed" }` only on an empty catalog. Archiving demo products is available in the dashboard.

## Validation

```sh
pnpm exec tsc --noEmit
node tests/commerce.test.mjs
python3 tests/concurrency.py
pnpm run build
```

The API integration runner bundles the actual route handler with an isolated SQLite-backed D1 test adapter. It checks server pricing, owner setup, authorization, private tracking, COD order creation, duplicate prevention, overselling rollback, restocking, coupons, unavailable payments and restart persistence. It does not exercise the deployed Cloudflare network or R2 service.

The concurrency test uses 24 independent buyers against one remaining unit and verifies exactly one committed order, zero remaining stock and no orphan orders.

Browser automation was unavailable in the authoring environment. Desktop/mobile layout, actual hosted sign-in, R2 uploads and a full hosted checkout still need browser acceptance testing. The application passed TypeScript checking and production compilation.

## Payment configuration

COD is functional. For bank transfer, enter account name, bank, IBAN and payment-reference instructions in Store & homepage; only then enable bank transfers. Customers receive instructions on the order page. An owner or manager verifies the real bank receipt before marking paid. Changing a payment status is an internal ledger update; it does not move or refund money.

Easypaisa, JazzCash and card options are displayed at checkout with a disabled Setup required status. Their server paths reject orders until a real adapter is configured. `lib/payments/index.ts` defines an adapter boundary but has **no installed online payment adapters or webhook endpoint**. Adding credentials alone does not activate them. For each selected provider, development still requires:

- Approved merchant account and enabled product/environment.
- Merchant/account identifiers, provider-issued signing/verification secrets and API credentials from its current integration documentation.
- Server-only initiation and documented signature verification using the raw callback body.
- A dedicated HTTPS callback endpoint (for example `/api/payments/<provider>/webhook`) implemented before registering it with the provider; that endpoint does not exist yet.
- Persistent payment/event tables with unique provider event IDs, amount/currency/order matching, retry handling and idempotent state transitions.
- Provider sandbox tests followed by merchant-approved live testing.

Never store card numbers or CVVs. Real refunds require the provider or bank workflow; marking an order refunded in this app is only a record.

## Storage and deployment

`.openai/hosting.json` declares `DB` and `BUCKET`. Sites provisions their hosted bindings. No external PostgreSQL/Supabase/S3 credential is needed for this implementation. Images are served through `/api/media/...`; upload authorization remains in `/api/admin/upload`.

The retained source repository is the source of truth. For Sites publication, run type/API/concurrency checks, package the Worker with the Sites build/source workflow, push the exact source commit, then deploy that saved version. Hosted schema migrations run before Worker deployment. Preserve the Site's private audience until the owner explicitly authorizes opening access.

For a standalone infrastructure migration, replace platform identity header trust with an appropriate authenticated edge/session system and bind real D1/R2 resources. This is not a drop-in PostgreSQL application; converting to PostgreSQL requires an adapter and migration/transaction changes.

Before schema upgrades, create a managed database export/snapshot and verify restoration in a separate environment; also retain product-image object backups. Automated backup scheduling and recovery drills are not provisioned by this code.

## Remaining work against the full brief

- Independent email/password registration, email verification/reset and app-specific admin 2FA (authentication is delegated to ChatGPT).
- Real online gateway adapters, payment event ledger/webhooks, provider refunds and courier APIs.
- Full visual block page builder, draft previews, mobile preview tooling, editable promotional card copy/images and editable customer-review homepage sections. Current pages are safe plain text; hero/menu/section order are editable.
- Product SEO rendering/canonicals/structured data/sitemap, search suggestions, genuine popularity sorting, recently viewed history, analytics events and integration. The private build deliberately uses noindex and disallows crawling.
- Bulk price/stock/status update UI beyond bulk archiving, full product deletion, per-product SEO fields, product relations/upsells, image drag-reordering, weight/dimensions and explicit category hierarchy enforcement. Image order is editable as an ordered URL list.
- City/region/weight delivery rules, COD eligibility rules, duplicate/suspicious-order signals, private confirmation notes, failed-delivery records and separate packing-slip design.
- Customer-specific/product/category coupons, start dates, first-order conditions and bundle pricing logic (the demo combo is a normal product).
- Deduplicated guest customer identities, address books, advanced CRM segments/timelines, automated reminders, automated data export/deletion handling and communication integrations. Guest orders currently create separate customer records; signed-in aggregate metrics use the account ID.
- Server pagination beyond the first 500 rows, full admin reports, staff removal, transactional audit atomicity and audit export controls beyond role checks.
- Operational security review, tested backups, distributed rate-limit retention cleanup, monitoring and end-to-end hosted/mobile accessibility testing.

This is a useful private working foundation; these gaps must not be represented as completed production features.

## October 15 update

The supplied horizontal gold wordmark replaces the mascot/header/footer branding and favicon. Bag and cart quantity controls remove one unit per minus click; Remove all is explicitly separate. Admin overview and first-owner setup explain the ChatGPT email-based login. There is no separate password form or app-managed credential.

## Supplier partnership enquiries

`/suppliers` accepts company/contact details, product descriptions, HTTPS catalog links, fulfillment proposals and a commission offer (percentage, fixed PKR per eligible sale, or negotiable). Consent is required. Proposals are persisted with an idempotent request key and reference. Owner and manager roles can review enquiries under Supplier enquiries, update New/Reviewing/Contacted/Approved/Declined status and keep private notes. Inventory/order/support roles cannot access proposals.

The form does not publish supplier products, send email or WhatsApp messages, create an agreement, or pay commissions automatically. The current Site remains private; external suppliers cannot access it until the owner separately authorizes an appropriate audience. Local testing uses its own database.
