# SYSTEM ARCHITECTURE & ENGINEERING CONTEXT

> **Product Vision:** A headless, multi-tenant eCommerce SaaS platform engineered for extreme performance, sub-second page loads, and bulletproof transactional scalability.
> **Target Audience:** Mid-market D2C brands (50–500 orders/day) and scaling merchants in Pakistan & MENA.
> **Engineering Motto:** *"One unified, lightning-fast commerce engine powering infinitely custom storefronts."*

**Last updated:** 2026-09-27 · **Branch:** `main` @ `cfeb602` (Hardening Step 3 complete) · **Status:** feature-complete for a pilot merchant; not yet deployed (see §10).

---

## 1. Core Architectural Invariants (Non-Negotiables)

Har naya module ya feature likhte waqt in rules ko follow karna lazmi hai. "Status" column batata hai ke code mein ye aaj kahan tak nafiz hai.

| # | Invariant | Engineering Rule | Status |
| :--- | :--- | :--- | :--- |
| **1** | **Integer Money Only** | `*_minor` integer columns (e.g. `249000` = PKR 2,490.00). Float math kabhi nahi. | ✅ Enforced. Discount math rounds to whole minor units (`discount-math.ts`). |
| **2** | **Zero-Leak Multi-Tenancy** | Har table par `tenant_id` denormalized; har query store/tenant se scoped. Store **server** decide karta hai, client nahi. | ✅ Enforced via guards (§5). `tenant_id` always equals the owning store's tenant (repaired in migration 0001). E2E-tested. |
| **3** | **Ultra-Fast API Pipeline** | NestJS on **Fastify**. Target p95 < 20ms. | ⚠️ Fastify ✅. Latency **never measured**; with Neon over the internet a round-trip is ~1–2s in dev. Measure in production. |
| **4** | **Sub-Second Storefront** | Next.js Server Components + tag-based ISR (`revalidateTag`). | ⚠️ ISR with 60s `revalidate` + tags ✅. `revalidateTag` is **not called anywhere yet**, so admin edits reach the storefront within ~60s, not instantly. |
| **5** | **Deadlock-Free Concurrency** | Stock rows locked sorted by id (`ORDER BY id FOR UPDATE`), fixed lock order. | ✅ Enforced in checkout and order re-open (§6). E2E-tested with parallel buyers. |
| **6** | **Immutable Order Snapshots** | Title, variant, SKU, unit price frozen on `order_items` at checkout. | ✅ Enforced. Products are retired by **unpublishing**, never deleted, so history stays intact. |
| **7** | **No Fake Data or Fake Success** *(added in hardening)* | Kabhi mock/demo data ya "optimistic" success mat dikhao. Failure = asli error. Numbers sirf database se. | ✅ All in-memory/demo fallbacks and hardcoded UI figures removed (Hardening Phase 1 & Step 1). |

---

## 2. Target Performance & Speed SLAs

Targets (none measured yet — add load testing before launch):

* **Storefront TTFB (Cache Hit):** `< 50ms` (via Edge CDN).
* **Storefront Full Page Load (LCP):** `< 1.2s` on mobile 4G.
* **Google PageSpeed Score:** `95 - 100` on Mobile.
* **API Response Time (Catalog Read):** `< 15ms`.
* **API Response Time (Cart / Checkout Mutation):** `< 40ms`.

---

## 3. Tech Stack

| Layer | Technology |
| :--- | :--- |
| Runtime | Node.js 24+, pnpm 9 monorepo, Turborepo |
| API | NestJS 11 on Fastify 5, pino JSON logs |
| Database | PostgreSQL (Neon), Drizzle ORM 0.38 (queries), hand-written SQL migrations |
| Frontends | Next.js 16 (App Router, `proxy.ts`), React 19, Tailwind 3, shadcn/ui |
| Auth | Own implementation: scrypt passwords, DB sessions, HttpOnly cookies |
| Tests | `node:test` (built-in) — unit + end-to-end |

---

## 4. Monorepo Structure & Package Map

```text
ecommerce-saas/
├── apps/
│   ├── web/                    # Storefront (Port 3000) — catalog, PDP, cart drawer, 1-page COD checkout,
│   │                           #   order confirmation (token-protected), store name/WhatsApp from API
│   ├── merchant-admin/         # Merchant Admin (Port 3001)
│   │   ├── app/                # login, dashboard, orders (+ detail), products, collections, customers,
│   │   │                       #   discounts, analytics, settings, error.tsx
│   │   ├── components/         # app-shell (sidebar/sign-out), product-editor, packing-label, error-banner, ui/
│   │   ├── lib/                # api.ts (client), server-auth.ts, order-checks.ts, slug.ts
│   │   ├── proxy.ts            # redirects to /login when there is no session cookie
│   │   └── next.config.mjs     # /api/* rewrite -> API_URL (same-origin cookies)
│   ├── platform-admin/         # Platform (Super) Admin (Port 3002) — login, metrics, tenants, account
│   │   └── (same pattern: app-shell, proxy.ts, /api rewrite, reset-password-dialog)
│   └── api/                    # NestJS + Fastify (Port 4000)
│       ├── src/
│       │   ├── auth/           # AuthService, guards (Merchant/Platform/StorefrontStore), session-token
│       │   ├── common/         # rate-limit guard, all-exceptions filter, pagination helpers
│       │   ├── products/       # storefront catalog + merchant products, variants, stock, collections
│       │   ├── cart/           # storefront cart
│       │   ├── orders/         # checkout (transactional) + merchant fulfillment
│       │   ├── customers/      # CRM (upsert on checkout, paginated list), phone.ts
│       │   ├── discounts/      # validate / atomic redeem / on-off, discount-math.ts
│       │   ├── analytics/      # SQL-aggregate store analytics
│       │   ├── store/          # store settings (name, WhatsApp)
│       │   ├── platform/       # tenants, platform metrics, merchant password reset
│       │   └── db/             # Drizzle provider, resolveTenantId, DbExecutor type
│       ├── test/               # unit.test.ts, e2e.test.ts
│       └── .env.example
├── packages/
│   ├── db/
│   │   ├── src/index.ts        # Drizzle schema + relations + client factory (what the code expects)
│   │   ├── migrations/         # 0001_baseline, 0002_taxonomy_categories, 0003_orders_province_not_null
│   │   └── src/                # migrate, check-schema, seed-demo, create-user, reset-password, reset, password
│   ├── typescript-config/  eslint-config/  ui/
├── README.md                   # setup, commands, tests, production notes
└── SYSTEM_ARCHITECTURE_CONTEXT.md  # THIS FILE (living architecture state)
```

`apps/docs` and `packages/ui` are unused Turborepo starter leftovers.

---

## 5. Auth, Tenancy & Security Model

* **Merchant routes (`/v1/merchant/*`)** — `MerchantGuard`: session cookie `posflow_merchant_session` → user (role `merchant`) → tenant (must be `active`). The store is decided **server-side**: `x-store-id` is honored only if that store belongs to the user's tenant (else 403); otherwise the tenant's first store. Services take `storeId` from `@CurrentMerchant()`, never from the request body/query.
* **Platform routes (`/v1/platform/*`)** — `PlatformGuard`: cookie `posflow_platform_session`, role `platform_admin`.
* **Storefront routes (`/v1/storefront/*`)** — `StorefrontStoreGuard`: store from `x-store-id` (else `DEFAULT_STORE_ID`); unknown stores and stores of suspended tenants return 404.
* **Sessions:** 7 days; DB stores only `sha256(token)`. Password change signs out the user's other sessions; platform reset signs out all of them. Suspending a tenant locks its merchants out on the next request.
* **Passwords:** scrypt (`packages/db/src/password.ts`), min 10 chars; 5 failed logins per email → 15-minute lockout.
* **Order privacy:** checkout returns a one-time `accessToken`; storefront order pages require it (`x-order-token`), only its hash is stored. Wrong/missing token = same 404 as a missing order.
* **IDs:** carts, orders, users use crypto-random ids (cart id is the shopper's bearer credential).
* **Same-origin admin API:** admin browsers call `/api/*` on their own host; `next.config.mjs` rewrites to `API_URL`. Server components call the API directly and forward cookies (`lib/server-auth.ts`). A cross-site API host would silently drop session cookies.
* **CORS:** explicit origin list with credentials (`CORS_ORIGINS`).
* **Mass assignment:** the order-status endpoint accepts only `financialStatus` / `fulfillmentStatus` / `orderStatus` with whitelisted values.

---

## 6. Checkout & Inventory Integrity

Checkout is **one transaction** that takes row locks in a fixed order — **cart → variants (sorted by id, `FOR UPDATE`) → discount → customer → store counter** — so concurrent checkouts queue instead of deadlocking.

* **Prices & stock** are read under lock (never trusted from the cart snapshot). Short lines → `409` with an `outOfStock` list. `CHECK (stock >= 0)` is the database-level backstop.
* **Order numbers:** `stores.next_order_number` incremented inside the transaction → `PF-<n>`, unique per store (`uq_orders_store_number`). Survives API restarts.
* **Discounts:** `DiscountsService.redeem()` checks active/dates/min-subtotal/usage-limit **and** increments `times_used` in one conditional `UPDATE`; an invalid code rejects checkout (never silently charges more than shown).
* **Customers:** one `INSERT … ON CONFLICT (store_id, phone) DO UPDATE` inside the transaction; Pakistani mobiles normalized to `+923xxxxxxxxx` (`customers/phone.ts`); VIP / repeat-buyer tags recomputed under the row lock.
* **Double submit:** the cart row lock + clearing the cart means a second submit finds an empty cart.
* **Status changes:** order row locked; cancel restocks exactly once; re-opening a cancelled order re-checks stock (`409` if gone). Courier booking is conditional on no existing CN.
* **Stock adjustments (merchant):** atomic `stock = stock + delta` that refuses to go below 0 — never "set to N", so a concurrent sale is not overwritten. Cart add/update also refuses quantities above stock (early, friendly check only).
* **Courier:** no Trax/Leopards API integration yet. The CN is generated in POSflow and the 4x6 label is a **packing label** that says so (no fake barcode).

---

## 7. Database Schema Map

All tables have `created_at`; mutable ones have `updated_at` (timestamptz). Money columns are integers in minor units.

| Table | Key columns | Notes |
| :--- | :--- | :--- |
| `tenants` | `id`, `name`, `default_currency`, `default_locale`, `status` (`active`/`suspended`) | |
| `stores` | `id`, `tenant_id`→tenants, `name`, `slug` (UNIQUE), `currency`, `timezone`, `whatsapp_phone` (E.164), `next_order_number` | |
| `categories` | `id`, `name`, `full_name`, `parent_id`→categories, `level` | Global taxonomy, seeded by migration 0002 |
| `collections` | `id`, `tenant_id`, `store_id`, `title`, `slug`, `collection_type`, `rules`, `is_published` | UNIQUE (`store_id`,`slug`) |
| `collection_products` | `collection_id`, `product_id`, `position` | |
| `products` | `id`, `tenant_id`, `store_id`, `category_id`, `title`, `slug`, `description`, `product_type`, `vendor`, `tags`, `options`, `is_published` | UNIQUE (`store_id`,`slug`) |
| `product_variants` | `id`, `product_id`, `title`, `sku`, `price_minor`, `compare_at_price_minor`, `stock` | `CHECK (stock >= 0)` |
| `carts` / `cart_items` | cart: `store_id`, `currency`; item: `variant_id`, `quantity` | Prices are never stored on the cart |
| `orders` | `store_id`, `order_number`, customer + shipping fields, `payment_method`, `financial_status`, `fulfillment_status`, `order_status`, `courier_*`, `customer_id`, `discount_code`, `discount_minor`, `subtotal/shipping_fee/total_minor`, `notes`, `access_token` | UNIQUE (`store_id`,`order_number`) |
| `order_items` | `order_id`, `variant_id`, `product_id`, `title`, `variant_title`, `sku`, `unit_price_minor`, `quantity`, `total_minor` | Immutable snapshot (no FK to variants) |
| `customers` | `store_id`, `phone` (normalized), names, `email`, `orders_count`, `total_spent_minor`, `tags`, `default_address` | UNIQUE (`store_id`,`phone`) |
| `customer_addresses` | `customer_id`, address fields | Not used by the app yet |
| `discounts` | `store_id`, `code`, `discount_type` (`percentage`/`fixed_amount`/`free_shipping`), `value`, `min_requirement_type`, `min_subtotal_minor`, `usage_limit`, `times_used`, `starts_at`, `ends_at`, `is_active` | UNIQUE (`store_id`, `upper(code)`) |
| `users` | `email` (UNIQUE, lowercased), `password_hash`, `role`, `tenant_id` (null for platform admins), `status` | |
| `sessions` | `id` = sha256(token), `user_id`, `expires_at` | |
| `schema_migrations` | `id` (file name), `checksum`, `applied_at` | Managed by `db:migrate` |

Unused columns that exist for future features: `discounts.applies_to`, `entitled_*_ids`, `min_quantity`, `once_per_customer`; `collections.rules` (smart collections); `stores.supported_locales`.

---

## 8. API Surface

Responses use `{ success, data }`; paginated lists add `nextCursor` (+ `counts` / `stats`). Errors: `{ statusCode, message }`, 500s add `requestId`.

**Health**
| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| GET | `/health` | Liveness (no DB) |
| GET | `/health/ready` | Readiness; 503 if the database is unreachable |

**Auth** (`/v1/auth`)
| Method | Endpoint | Guard / limit |
| :--- | :--- | :--- |
| POST | `/merchant/login`, `/platform/login` | public · 10/min per IP |
| POST | `/merchant/logout`, `/platform/logout` | public |
| GET | `/merchant/me` (incl. `storeId`, `storeName`), `/platform/me` | session |
| POST | `/merchant/password`, `/platform/password` | session · 5/min |

**Storefront** (`/v1/storefront`, `StorefrontStoreGuard`)
| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| GET | `/store` | Public store info: name, currency, WhatsApp |
| GET | `/products`, `/products/:slug` | Published only |
| GET | `/collections`, `/collections/:slug` | Published only; unpublished products filtered out |
| GET | `/cart` · POST `/cart/items` (60/min) · PATCH/DELETE `/cart/items/:itemId` | `x-cart-id` header |
| POST | `/discounts/validate` | 20/min (anti code-guessing) |
| POST | `/orders/checkout` | 10/min; returns order + one-time `accessToken` |
| GET | `/orders/:id` | 30/min; requires `x-order-token` |
| POST | `/orders/:id/verify-whatsapp` | 10/min; requires `x-order-token` |

**Merchant** (`/v1/merchant`, `MerchantGuard`)
| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| GET/PATCH | `/store` | Store name, WhatsApp number |
| GET | `/orders?limit&cursor&tab&q` | Keyset pages; tabs `all, unverified, pending_dispatch, in_transit, delivered, cancelled`; exact `counts` |
| GET | `/orders/:id` | |
| PATCH | `/orders/:id/status`, `/orders/:id/notes` | Whitelisted status fields |
| POST | `/orders/:id/book-courier`, `/orders/:id/verify-whatsapp` | |
| GET/POST | `/products` | |
| PATCH | `/products/:productId` | Details, slug, publish/unpublish |
| PATCH | `/products/:productId/variants/:variantId` | SKU, title, prices |
| POST | `/products/:productId/variants/:variantId/stock-adjustments` | `{ delta }` |
| GET | `/categories` · GET/POST `/collections` | |
| GET/POST | `/discounts` · PATCH `/discounts/:id` | `{ isActive }` |
| GET | `/customers?limit&cursor&q`, `/customers/:id` | Store-wide `stats`; search by name/email/phone digits |
| GET | `/analytics` | SQL aggregates, days in store timezone |

**Platform** (`/v1/platform`, `PlatformGuard`)
| Method | Endpoint | Notes |
| :--- | :--- | :--- |
| GET | `/analytics` | Active tenants/stores, 30-day GMV; ARR & latency `null` (not tracked) |
| GET/POST | `/tenants` | Create = tenant + store + owner merchant login, in one transaction |
| PATCH | `/tenants/:id/status` | `active` / `suspended` |
| GET | `/tenants/:id/users` | |
| POST | `/users/:id/password` | Reset a merchant's password · 10/min |

---

## 9. Operations

* **Schema changes:** edit `packages/db/src/index.ts` **and** add a new numbered file in `packages/db/migrations`. `pnpm db:migrate` applies pending files (one transaction each, checksum-recorded, advisory-locked) and refuses if an applied file was edited. `pnpm db:check` fails on drift between the database and the Drizzle schema. `drizzle-kit` is for Studio only.
* **Data scripts:** `db:seed` (demo store; refuses in production), `db:create-user`, `db:reset-password` (hidden prompts), `db:status`, `db:reset --confirm` (drops everything; refuses in production).
* **Rate limiting:** global per-IP limit (`RATE_LIMIT_PER_MINUTE`, default 300) + per-route limits (§8). `429` with `Retry-After`. In-memory → move to Redis before running several API instances. `TRUST_PROXY` = number of proxies in front of the API.
* **Observability:** pino JSON request logs (cookies/tokens redacted); `x-request-id` on every response; unexpected errors logged with that id and returned as a generic 500 carrying it; graceful shutdown hooks.
* **Scale:** orders/customers keyset-paginated (default 50, max 200); analytics and tab counts computed by Postgres.
* **Tests:**
  * `pnpm --filter api test` — unit (phone normalization, discount math, pagination), no DB.
  * `E2E_ALLOW_WRITES=true pnpm --filter api test:e2e` — builds and boots the API on a spare port, runs 14 end-to-end checks (auth, tenant isolation, 8-buyer last-unit race, coupon race, unique order numbers, customer upsert, double submit, order tokens, restock-once, pagination, analytics, stock adjust, WhatsApp validation, password change), then deletes everything it created. **Writes to `DATABASE_URL`** — use a Neon branch.

### Environment variables
| Variable | App | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | api, db | — | Postgres connection (Neon: `sslmode=require`) |
| `PORT` | api | `4000` | |
| `NODE_ENV` | all | `development` | `production` = secure cookies, rate limits forced on, seed/reset refused |
| `CORS_ORIGINS` | api | `http://localhost:3000,3001,3002` | Browser origins allowed (with credentials) |
| `DEFAULT_STORE_ID` | api | `store_default` | Storefront store when no `x-store-id` |
| `TRUST_PROXY` | api | (off) | Proxy hop count for real client IPs |
| `RATE_LIMIT_PER_MINUTE` | api | `300` | Global per-IP limit |
| `RATE_LIMIT_DISABLED` | api | — | Test suite only; ignored in production |
| `LOG_LEVEL` | api | `info` | pino level |
| `COOKIE_DOMAIN` | api | (host-only) | Optional; normally unset |
| `API_URL` | merchant-admin, platform-admin | `http://127.0.0.1:4000` | Target of the `/api/*` rewrite and server-side calls |
| `NEXT_PUBLIC_API_URL` | web | `http://127.0.0.1:4000` | Storefront calls the API directly |
| `NEXT_PUBLIC_STORE_ID` | web | `store_default` | Store this storefront sells for |
| `NEXT_PUBLIC_STOREFRONT_URL` | admins | `http://localhost:3000` | "View storefront" links |
| `NEXT_PUBLIC_MERCHANT_ADMIN_URL` | platform-admin | `http://localhost:3001` | "Merchant portal" links |

---

## 10. Implementation Log & Changelog

### Original build — Phases 1–5
Monorepo, Drizzle schema, NestJS+Fastify API, storefront (catalog, PDP, cart drawer, COD checkout, confirmation), merchant admin (dashboard, orders, courier dispatch, label), platform admin. A 2026-09-26 code review found this build did **not** run as described: the API crashed on boot (duplicate route), merchant-admin failed type-checking, no endpoint had authentication, several queries ignored the tenant, checkout had no transaction or stock check, and many screens showed mock/demo data or reported success on failure. The hardening work below fixed that. Claims from the original log that were untrue or have been replaced: "graceful offline resilience via mock data" (removed — Invariant 7), "store switcher" (never built), `/v1/admin/*` routes (removed), "Thermal Airway Bill" (now an honest packing label), `db:generate`/`init-db.ts` (replaced by SQL migrations).

### Hardening Phase 1 — API boots, builds pass, no fake data *(commit `2490a95`)*
- [x] Removed the duplicate `GET /v1/merchant/analytics` route that crashed startup; fixed merchant-admin type errors; `strictNullChecks` in the API.
- [x] Removed in-memory carts/orders and demo catalog/analytics fallbacks; failures return real errors.
- [x] Checkout in a transaction; invalid discount codes reject checkout; order-status field whitelist; restock only on a real cancel.
- [x] `tenant_id` derived from the owning store; analytics scoped to the store; real platform metrics; tenant create/suspend actually call the API.
- [x] Admin UIs surface API errors; slug auto-generation bug fixed; courier CN stored in courier columns.

### Hardening Phase 2 — Authentication & tenant scoping *(`11246e1`, `5be79cf`)*
- [x] `users`/`sessions`, scrypt, HttpOnly cookies, login lockout; Merchant/Platform/Storefront guards (§5).
- [x] Customers, discounts and order actions scoped to the store; order access tokens; random ids; CORS allow-list.
- [x] Unique indexes per store; tenant_id repair; login pages, `proxy.ts`, sign-out; `db:create-user`; `db:reset --confirm`.
- [x] Fix: admin apps proxy the API same-origin — the browser was dropping cross-site session cookies.

### Hardening Step 1 — Honest UI *(`2cc3d3b`)*
- [x] Replaced hardcoded figures: COD "risk" box (now real phone/metro/WhatsApp checks), analytics "+14.8%/2.4 units/100%", label courier/shipper/weight/barcode, product fallbacks, platform "Active Tenants".
- [x] Real store name in the sidebar; customers `?search=`; dashboard links to the order.

### Hardening Phase 3 — Race-safe checkout *(`8aeffd8`)* — see §6
- [x] Sorted `FOR UPDATE` locks, stock check with `409 outOfStock`, `CHECK (stock >= 0)`.
- [x] Per-store DB order numbers; atomic discount redemption; customer upsert; locked status transitions.

### Hardening Step 2 — Merchant features *(`807d1c4`)*
- [x] Store settings (name, WhatsApp) + storefront header/WhatsApp from the API (was hardcoded `923001234567`).
- [x] Product editor: details, slug, publish/unpublish, variant SKU/prices, atomic stock adjustments.
- [x] Discount on/off; password change (merchant & platform); platform reset of merchant passwords; `db:reset-password`.

### Hardening Step 3 — Operational safety *(`cfeb602`)* — see §9
- [x] Rate limiting, structured logging, request ids, error filter, `/health/ready`.
- [x] SQL migration system (`db:migrate`, `db:status`, `db:check`, `db:seed`); migration 0003 fixed a drift `db:check` found.
- [x] Keyset pagination with server-side tabs/search/counts; SQL-aggregate analytics in store timezone.
- [x] Unit + end-to-end test suites (the e2e suite caught two bugs fixed in this step).
- [x] Real README and `apps/api/.env.example`.

### Next — Step 4: Launch
- [ ] Production database (separate Neon project/branch) + `db:migrate`; point-in-time restore enabled and a restore tested.
- [ ] Hosting for API and the three Next apps; domains + HTTPS; production env vars (§9).
- [ ] Push the repository to a private remote (currently local only).

### Backlog (after launch)
- [ ] Call `revalidateTag` on product/store edits (Invariant 4) and measure the latency SLAs (Invariant 3).
- [ ] Courier API integration (Trax/Leopards) for real CNs and airway bills.
- [ ] Subscription plans & billing (platform ARR is currently `null`).
- [ ] Product images; collection editing / assigning products after creation; multi-store switcher UI.
- [ ] Rate limits and lockouts in Redis for multi-instance; error tracking (e.g. Sentry); ESLint configs for the admin apps.
- [ ] Email-based "forgot password" (needs an email provider).
- [ ] Remove unused `apps/docs` and `packages/ui`.

---

## 11. Instructions for Future AI & Engineers
1. **Never use Prisma:** Drizzle ORM is the query layer.
2. **Never install Fastify packages in root:** backend packages in `apps/api`, schema in `packages/db`.
3. **Always update this file** when a module, table, route or architectural decision changes.
4. **Schema changes = two edits:** `packages/db/src/index.ts` + a new numbered SQL migration. Never edit an applied migration. Run `pnpm db:check`.
5. **Never trust the client for tenancy:** merchant services take `storeId` from `@CurrentMerchant()`; storefront services from `@StorefrontStore()`.
6. **No fake data, no fake success (Invariant 7):** no mock fallbacks, no hardcoded metrics, no "optimistic" success on errors. Show the real error.
7. **Anything touching stock, order numbers, discounts or customers at checkout** goes inside the checkout transaction and follows the lock order in §6.
8. **Money is integer minor units** end to end; convert to rupees only for display.
9. **Run the tests** (`pnpm --filter api test`, and the e2e suite against a Neon branch) before merging.
