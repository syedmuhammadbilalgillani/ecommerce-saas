# SYSTEM ARCHITECTURE & ENGINEERING CONTEXT

> **Product Vision:** A headless, multi-tenant eCommerce SaaS platform engineered for extreme performance, sub-second page loads, and bulletproof transactional scalability.
> **Target Audience:** Mid-market D2C brands (50–500 orders/day) and scaling merchants in Pakistan & MENA.
> **Engineering Motto:** *"One unified, lightning-fast commerce engine powering infinitely custom storefronts."*

---

## 1. Core Architectural Invariants (Non-Negotiables)

Har naya module ya feature likhte waqt in 6 rules ko follow karna lazmi hai:

| # | Invariant | Engineering Rule | Why it matters |
| :--- | :--- | :--- | :--- |
| **1** | **Integer Money Only** | `price_minor` integer store hoga (e.g., `249000` = PKR 2,490.00). Float math kabhi use nahi hoga. | Float math round-off errors aur financial reconciliation bugs produce karta hai. |
| **2** | **Zero-Leak Multi-Tenancy** | Har table par `tenant_id` denormalized hoga. Har query `store_id` aur `tenant_id` se strictly scoped hogi. | Tenant A ka data Tenant B ko kabhi leak na ho sake. |
| **3** | **Ultra-Fast API Pipeline** | NestJS default Express ke bajaye **Fastify HTTP adapter** par chalega. Response latency target: **p95 < 20ms**. | High concurrency flash sales (11.11 / Eid) par server crash na ho. |
| **4** | **Sub-Second Storefront** | Next.js Server Components + Tag-based ISR (`revalidateTag`). Zero unnecessary client-side JavaScript. | Mobile 4G par instant page load (< 1s) = Maximum conversion rate. |
| **5** | **Deadlock-Free Concurrency** | Inventory reserve karte waqt variant IDs alphabetically sort hongi (`ORDER BY variant_id ASC FOR UPDATE`). | Flash sales me multiple buyers aane par DB deadlocks na hon. |
| **6** | **Immutable Order Snapshots** | Order create hote waqt product title, SKU, variant, price aur tax ka frozen snapshot persist hoga. | Agar merchant baad me product edit ya delete kare, purana order corrupt na ho. |

---

## 2. Target Performance & Speed SLAs

* **Storefront TTFB (Cache Hit):** `< 50ms` (via Edge CDN).
* **Storefront Full Page Load (LCP):** `< 1.2s` on mobile 4G.
* **Google PageSpeed Score:** `95 - 100` on Mobile.
* **API Response Time (Catalog Read):** `< 15ms`.
* **API Response Time (Cart / Checkout Mutation):** `< 40ms`.

---

## 3. Monorepo Structure & Package Map

```text
ecommerce-saas/
├── apps/
│   ├── web/                  # Next.js 15 Customer Storefront (Port 3000)
│   │   ├── app/              # Catalog, PDP, Slide-over Cart, 1-Page COD Checkout
│   │   └── package.json
│   │
│   ├── merchant-admin/       # Next.js 15 Merchant Store Admin (Port 3001)
│   │   ├── app/              # Calm, minimal UI: Products Catalog, Variants, Orders, Trax Dispatch, 4x6 Thermal Label
│   │   ├── components/ui/    # shadcn/ui components (calm font weights, muted zinc)
│   │   └── package.json
│   │
│   ├── platform-admin/       # Next.js 15 SaaS Super Admin (Port 3002)
│   │   ├── app/              # Platform ARR, Multi-Tenant Stores, Subscriptions, Fleet Latency
│   │   └── package.json
│   │
│   └── api/                  # NestJS + Fastify HTTP Core (Port 4000)
│       ├── src/
│       │   ├── products/     # Storefront & Merchant Catalog APIs
│       │   ├── cart/         # Cart & Session APIs
│       │   ├── orders/       # Checkout & Merchant Fulfillment APIs
│       │   ├── platform/     # SaaS Super Admin APIs
│       │   └── db/           # Drizzle DB global injection module
│       └── package.json
│
├── packages/
│   ├── db/                   # Drizzle ORM + PostgreSQL client + Migrations
│   ├── typescript-config/    # Shared TypeScript configurations
│   ├── eslint-config/        # Shared ESLint rules
│   └── ui/                   # Shared React component library
│
├── pnpm-workspace.yaml       # pnpm monorepo workspace configuration
├── turbo.json                # Turborepo build pipeline
└── SYSTEM_ARCHITECTURE_CONTEXT.md  # THIS FILE (Living architecture state)
```

---

## 4. Database Schema Map (Implemented So Far)

### `tenants`
* `id` (text, PK) — e.g. `ten_pilot_01`
* `name` (text)
* `default_currency` (text, default `'PKR'`) — ISO 4217 (e.g. `'PKR'`, `'AED'`, `'SAR'`, `'USD'`)
* `default_locale` (text, default `'en'`) — e.g. `'en'`, `'ur'`, `'ar'`
* `status` (text, default `'active'`)
* `created_at`, `updated_at` (timestamptz)

### `stores`
* `id` (text, PK) — e.g. `store_default`
* `tenant_id` (text, FK $\rightarrow$ `tenants.id`, CASCADE)
* `name` (text)
* `slug` (text, UNIQUE) — e.g. `outfitters-pk`
* `currency` (text, default `'PKR'`) — Store primary commerce currency
* `default_locale` (text, default `'en'`) — Store primary language
* `supported_locales` (text[], default `['en']`) — e.g. `['en', 'ur']` (for multi-language toggle)
* `timezone` (text, default `'Asia/Karachi'`)
* `created_at`, `updated_at` (timestamptz)

### `categories` (Shopify Standard Taxonomy)
* `id` (text, PK) — e.g. `cat_tshirts`
* `name` (text) — e.g. `T-Shirts`
* `full_name` (text) — e.g. `Apparel & Accessories > Clothing > Shirts & Tops > T-Shirts`
* `parent_id` (text, FK $\rightarrow$ `categories.id`, nullable)
* `level` (integer, default `0`)

### `collections` (Storefront Merchandising)
* `id` (text, PK) — e.g. `col_summer_2026`
* `tenant_id` (text, FK $\rightarrow$ `tenants.id`, CASCADE)
* `store_id` (text, FK $\rightarrow$ `stores.id`, CASCADE)
* `title` (text) — e.g. `Summer 2026 Collection`
* `slug` (text) — e.g. `summer-2026`
* `description` (text)
* `image_url` (text)
* `collection_type` (text, default `'manual'`) — `'manual'` | `'smart'`
* `rules` (jsonb) — Automated rules for smart collections
* `is_published` (boolean, default `true`)

### `collection_products` (Many-to-Many Join)
* `id` (text, PK)
* `tenant_id` (text, FK $\rightarrow$ `tenants.id`)
* `collection_id` (text, FK $\rightarrow$ `collections.id`, CASCADE)
* `product_id` (text, FK $\rightarrow$ `products.id`, CASCADE)
* `position` (integer, default `0`)

### `products`
* `id` (text, PK) — e.g. `prod_01`
* `tenant_id` (text, FK $\rightarrow$ `tenants.id`)
* `store_id` (text, FK $\rightarrow$ `stores.id`)
* `category_id` (text, FK $\rightarrow$ `categories.id`, nullable) — Exactly 1 category per product
* `title` (text)
* `slug` (text)
* `description` (text)
* `product_type` (text, nullable) — e.g. `T-Shirt`
* `vendor` (text, nullable) — e.g. `Outfitters PK`
* `tags` (text[], default `[]`)
* `options` (jsonb) — Dynamic option dimensions: `[{ name: "Color", values: ["Black", "White"] }]`
* `is_published` (boolean, default `true`)
* `created_at`, `updated_at` (timestamptz)
* **Indexes:** `idx_products_store_slug`, `idx_products_tenant`, `idx_products_category`

### `product_variants`
* `id` (text, PK) — e.g. `var_01`
* `tenant_id` (text, FK $\rightarrow$ `tenants.id`)
* `product_id` (text, FK $\rightarrow$ `products.id`, CASCADE)
* `title` (text, default `'Default Title'`)
* `sku` (text)
* `price_minor` (integer) — e.g. `249000` = PKR 2,490
* `compare_at_price_minor` (integer, nullable)
* `stock` (integer, default `0`)
* `created_at`, `updated_at` (timestamptz)
* **Indexes:** `idx_variants_product (product_id)`, `idx_variants_tenant (tenant_id)`

---

### `users` / `sessions` (Auth — added in Hardening Phase 2)
* `users`: `id`, `email` (UNIQUE, lowercased), `name`, `password_hash` (scrypt), `role` (`merchant` | `platform_admin`), `tenant_id` (null for platform admins), `status`
* `sessions`: `id` = **sha256 of the session token** (raw token never stored), `user_id`, `expires_at` (7 days)
* `orders.access_token` = sha256 of the shopper's order token (storefront order lookups require the raw token)
* Unique per store: `products(store_id, slug)`, `collections(store_id, slug)`, `discounts(store_id, upper(code))`, `customers(store_id, phone)`

## Auth & Tenant Scoping (Hardening Phase 2)

* **Merchant routes (`/v1/merchant/*`)** use `MerchantGuard`: session cookie `posflow_merchant_session` → user → tenant. The store is decided **server-side**: `x-store-id` is honored only if that store belongs to the user's tenant (else 403); otherwise the tenant's first store. Services always receive `storeId` from `@CurrentMerchant()`, never from the client.
* **Platform routes (`/v1/platform/*`)** use `PlatformGuard` (cookie `posflow_platform_session`, role `platform_admin`).
* **Storefront routes (`/v1/storefront/*`)** use `StorefrontStoreGuard`: store from `x-store-id` (else `DEFAULT_STORE_ID`); unknown or suspended-tenant stores return 404.
* Suspending a tenant immediately invalidates its merchants' sessions (checked on every request).
* Admin apps never call the API cross-origin from the browser: they call `/api/*` on their own host, which `next.config.mjs` rewrites to `API_URL`. This keeps session cookies first-party (a cross-site API host would silently drop them).
* Accounts: `pnpm db:create-user --role platform_admin --email ...` (hidden password prompt). Platform admins create a tenant together with its owner's merchant login.

### Environment variables
| Variable | App | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `CORS_ORIGINS` | api | `http://localhost:3000,3001,3002` | Comma-separated origins allowed to send cookies |
| `COOKIE_DOMAIN` | api | (host-only) | Optional; normally unset because admin apps proxy the API same-origin |
| `API_URL` | merchant-admin, platform-admin | `http://127.0.0.1:4000` | Backend for the `/api/*` rewrite and for server components |
| `DEFAULT_STORE_ID` | api | `store_default` | Store used when a storefront request has no `x-store-id` |
| `NEXT_PUBLIC_STORE_ID` | web | `store_default` | Store this storefront deployment sells for |
| `NEXT_PUBLIC_STOREFRONT_URL` | admins | `http://localhost:3000` | Links to the live storefront |
| `NEXT_PUBLIC_MERCHANT_ADMIN_URL` | platform-admin | `http://localhost:3001` | Link to the merchant portal |

## 5. API Surface (Storefront v1)

| Method | Endpoint | Description | Performance Target |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Instant health check & uptime ping | `< 2ms` |
| `GET` | `/v1/storefront/products` | List all published products with variants | `< 15ms` |
| `GET` | `/v1/storefront/products/:slug` | Get single product detail by slug with variants | `< 10ms` |

---

## 6. Implementation Log & Changelog

### Phase 1: Foundation & The Speed Core (COMPLETED)
- [x] Converted repository from default npm to high-performance **pnpm monorepo**.
- [x] Configured `pnpm-workspace.yaml` and `.npmrc` workspace linking.
- [x] Built `@repo/db` package with **Drizzle ORM** and pure ESM compatibility.
- [x] Designed core catalog tables (`tenants`, `stores`, `products`, `product_variants`) with composite performance indexes.
- [x] Resolved ESM circular dependency issues by isolating `relations.ts`.
- [x] Configured `apps/api` with **NestJS + Fastify HTTP Adapter** and enabled global CORS.
- [x] Wired dependency injection for Drizzle client into NestJS (`DbModule`).
- [x] Implemented `ProductsController` and `ProductsService` for storefront catalog reads.
- [x] Added root convenience scripts: `pnpm db:push`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`, `pnpm db:seed`.

### Phase 2: Live Storefront Integration (COMPLETED)
- [x] Connected `apps/web` (Next.js 15) to Fastify API via Server Components.
- [x] Created `lib/api.ts` with minor-unit price formatting (`formatPrice`) and ISR revalidation.
- [x] Implemented modern dark-mode catalog homepage with zero client-side JavaScript overhead.
- [x] Implemented `/products/[slug]` Product Detail Page (PDP) with interactive `VariantSelector` island.
- [x] Added COD (Cash on Delivery) flow trigger and express shipping indicators.
- [x] Tested graceful offline resilience (fallback mock data if Postgres is momentarily disconnected).

### Phase 3: The Cart System (COMPLETED)
- [x] Designed `carts` and `cart_items` tables with composite indexes in `@repo/db`.
- [x] Built Fastify `CartService` with backend-authoritative subtotal calculation in integer minor units.
- [x] Implemented REST endpoints: `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`.
- [x] Created `CartProvider` React context with `localStorage` session persistence.
- [x] Built interactive Slide-over Cart Drawer (`CartDrawer.tsx`) with quantity (+ / -) controls, trash, and subtotal.
- [x] Added dynamic header cart trigger with live item count badge.
- [x] Connected PDP `VariantSelector` to trigger instant add-to-cart and slide-over opening.

### Phase 4: One-Page Checkout & Order Placement (COMPLETED)
- [x] Designed `orders` table with status decoupling (`financialStatus`, `fulfillmentStatus`, `orderStatus`).
- [x] Designed `order_items` with immutable frozen snapshots (`title`, `variantTitle`, `sku`, `unitPriceMinor`, `totalMinor`).
- [x] Implemented `OrdersService` and `OrdersController` with `POST /orders/checkout` and `GET /orders/:id`.
- [x] Created One-Page Checkout UI (`/checkout`) optimized for Pakistan/MENA (Phone/WhatsApp first, City selector, COD default).
- [x] Created Order Confirmation & Receipt Screen (`/order-confirmation/[id]`) with live tracking and COD instructions.
- [x] Updated Slide-over Cart Drawer to route seamlessly into checkout flow.
- [x] Automated table migration in `packages/db/src/init-db.ts` for Neon PostgreSQL.

### Phase 5: Courier Integration & Merchant Admin (COMPLETED)
- [x] Configured shadcn/ui design system with Tailwind CSS and official `components.json`.
- [x] Implemented reusable shadcn component suite in `components/ui/` (`Button`, `Card`, `Badge`, `Table`, `Input`, `Label`, `Tabs`, `Separator`).
- [x] Created Merchant Admin Layout (`/admin`) with store switcher, sidebar navigation, and live metrics.
- [x] Built Executive Dashboard with 4 KPIs: Gross Revenue, Total Orders, COD Cash in Transit, RTO Return Rate.
- [x] Implemented Orders Data Table with tabs filtering (`All`, `Pending COD`, `In Transit`, `Delivered`, `Cancelled`).
- [x] Built 1-Click Courier Dispatch system generating Consignment Numbers (CN) for Trax / Leopards.
- [x] Created Pakistan Express Thermal Airway Bill label modal ready for 4x6 packing print.
- [x] Built backend Admin APIs in Fastify: `GET /v1/admin/orders`, `GET /v1/admin/analytics`, `PATCH /v1/admin/orders/:id/status`, `POST /v1/admin/orders/:id/book-courier`.

### Phase 6: Product Catalog & Inventory Manager (NEXT STEP)
- [ ] Admin "Add Product" form with Shopify-style options (Size, Color) generating permutation variants.
- [ ] Real-time inventory adjustment & stock sync.
- [ ] Image upload & gallery support.
- [ ] Multi-store toggle & tenant switching.

---

## 7. Instructions for Future AI & Engineers
1. **Never use Prisma:** Drizzle ORM is frozen as the query engine for speed and memory efficiency.
2. **Never install Fastify packages in root:** Keep backend packages in `apps/api` and database schema in `packages/db`.
3. **Always update this file** whenever a new module, table, or architectural decision is implemented.
