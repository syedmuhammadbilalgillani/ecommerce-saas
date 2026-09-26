-- 0001 baseline: the full schema as of Hardening Step 3.
-- Every statement is idempotent, so this can be applied both to an empty database and to one
-- that was built earlier with the old init-db script (it then only fills in what is missing).

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "default_currency" text DEFAULT 'PKR' NOT NULL,
  "default_locale" text DEFAULT 'en' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stores" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "currency" text DEFAULT 'PKR' NOT NULL,
  "default_locale" text DEFAULT 'en' NOT NULL,
  "supported_locales" text[] DEFAULT ARRAY['en'] NOT NULL,
  "timezone" text DEFAULT 'Asia/Karachi' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "whatsapp_phone" text;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "next_order_number" integer DEFAULT 1001 NOT NULL;

CREATE TABLE IF NOT EXISTS "categories" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "full_name" text NOT NULL,
  "parent_id" text REFERENCES "categories"("id") ON DELETE SET NULL,
  "level" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "collections" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "store_id" text NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "image_url" text,
  "collection_type" text DEFAULT 'manual' NOT NULL,
  "rules" jsonb,
  "is_published" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "store_id" text NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "category_id" text REFERENCES "categories"("id") ON DELETE SET NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "product_type" text,
  "vendor" text,
  "tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "options" jsonb,
  "is_published" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category_id" text REFERENCES "categories"("id") ON DELETE SET NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "product_type" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "vendor" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT ARRAY[]::text[] NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "options" jsonb;

CREATE TABLE IF NOT EXISTS "collection_products" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "collection_id" text NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "title" text DEFAULT 'Default Title' NOT NULL,
  "sku" text NOT NULL,
  "price_minor" integer NOT NULL,
  "compare_at_price_minor" integer,
  "stock" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
-- Stock can never go negative, even if application code has a bug.
DO $$ BEGIN
  ALTER TABLE "product_variants" ADD CONSTRAINT "chk_variants_stock_nonnegative" CHECK ("stock" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "carts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "store_id" text NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "currency" text DEFAULT 'PKR' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "cart_items" (
  "id" text PRIMARY KEY NOT NULL,
  "cart_id" text NOT NULL REFERENCES "carts"("id") ON DELETE CASCADE,
  "variant_id" text NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "quantity" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "customers" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "store_id" text NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "first_name" text,
  "last_name" text,
  "email" text,
  "phone" text NOT NULL,
  "orders_count" integer DEFAULT 0 NOT NULL,
  "total_spent_minor" integer DEFAULT 0 NOT NULL,
  "state" text DEFAULT 'enabled' NOT NULL,
  "tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "notes" text,
  "default_address" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "customer_addresses" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "customer_id" text NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "name" text,
  "phone" text,
  "address1" text NOT NULL,
  "address2" text,
  "city" text NOT NULL,
  "province" text DEFAULT 'Pakistan' NOT NULL,
  "postal_code" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "store_id" text NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "order_number" text NOT NULL,
  "customer_name" text NOT NULL,
  "customer_phone" text NOT NULL,
  "customer_email" text,
  "shipping_address_line1" text NOT NULL,
  "shipping_address_line2" text,
  "shipping_city" text NOT NULL,
  "shipping_province" text DEFAULT 'Pakistan' NOT NULL,
  "shipping_postal_code" text,
  "payment_method" text DEFAULT 'cod' NOT NULL,
  "financial_status" text DEFAULT 'pending' NOT NULL,
  "fulfillment_status" text DEFAULT 'unfulfilled' NOT NULL,
  "order_status" text DEFAULT 'open' NOT NULL,
  "courier_name" text,
  "courier_tracking_number" text,
  "courier_status" text,
  "currency" text DEFAULT 'PKR' NOT NULL,
  "subtotal_minor" integer NOT NULL,
  "shipping_fee_minor" integer DEFAULT 0 NOT NULL,
  "total_minor" integer NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_id" text REFERENCES "customers"("id") ON DELETE SET NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_code" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_minor" integer DEFAULT 0 NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courier_name" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courier_tracking_number" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courier_status" text;
-- sha256 of the shopper's order token; storefront order lookups require the raw token.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "access_token" text;

CREATE TABLE IF NOT EXISTS "order_items" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "variant_id" text,
  "product_id" text,
  "title" text NOT NULL,
  "variant_title" text NOT NULL,
  "sku" text NOT NULL,
  "unit_price_minor" integer NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "total_minor" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "discounts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "store_id" text NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "discount_type" text NOT NULL,
  "value" integer NOT NULL,
  "applies_to" text DEFAULT 'all_products' NOT NULL,
  "entitled_collection_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "entitled_product_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "min_requirement_type" text DEFAULT 'none' NOT NULL,
  "min_subtotal_minor" integer DEFAULT 0 NOT NULL,
  "min_quantity" integer DEFAULT 0 NOT NULL,
  "usage_limit" integer,
  "times_used" integer DEFAULT 0 NOT NULL,
  "once_per_customer" boolean DEFAULT false NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "password_hash" text NOT NULL,
  "role" text NOT NULL,
  "tenant_id" text REFERENCES "tenants"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Start each store's order counter after its highest existing "PF-<n>" so numbers are never reused.
UPDATE "stores" s SET "next_order_number" = m.next
FROM (
  SELECT "store_id", MAX(substring("order_number" FROM '[0-9]+$')::int) + 1 AS next
  FROM "orders" WHERE "order_number" ~ '[0-9]+$' GROUP BY "store_id"
) m
WHERE s."id" = m."store_id" AND s."next_order_number" < m.next;

-- Indexes (older non-unique versions are replaced by unique ones)
DROP INDEX IF EXISTS "idx_collections_store_slug";
DROP INDEX IF EXISTS "idx_products_store_slug";
DROP INDEX IF EXISTS "idx_customers_phone";
DROP INDEX IF EXISTS "idx_discounts_store_code";
CREATE INDEX IF NOT EXISTS "idx_categories_parent" ON "categories" ("parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_collections_store_slug" ON "collections" ("store_id", "slug");
CREATE INDEX IF NOT EXISTS "idx_collections_tenant" ON "collections" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_col_prod_collection" ON "collection_products" ("collection_id");
CREATE INDEX IF NOT EXISTS "idx_col_prod_product" ON "collection_products" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_col_prod_tenant" ON "collection_products" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_products_store_slug" ON "products" ("store_id", "slug");
CREATE INDEX IF NOT EXISTS "idx_products_tenant" ON "products" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_products_category" ON "products" ("category_id");
CREATE INDEX IF NOT EXISTS "idx_variants_product" ON "product_variants" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_variants_tenant" ON "product_variants" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_carts_store" ON "carts" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_carts_tenant" ON "carts" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_cart_items_cart" ON "cart_items" ("cart_id");
CREATE INDEX IF NOT EXISTS "idx_cart_items_variant" ON "cart_items" ("variant_id");
CREATE INDEX IF NOT EXISTS "idx_orders_store" ON "orders" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_orders_tenant" ON "orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_orders_phone" ON "orders" ("customer_phone");
CREATE INDEX IF NOT EXISTS "idx_orders_created" ON "orders" ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_orders_store_number" ON "orders" ("store_id", "order_number");
CREATE INDEX IF NOT EXISTS "idx_order_items_order" ON "order_items" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_order_items_tenant" ON "order_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_customers_store" ON "customers" ("store_id");
CREATE INDEX IF NOT EXISTS "idx_customers_tenant" ON "customers" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_customers_store_phone" ON "customers" ("store_id", "phone");
CREATE INDEX IF NOT EXISTS "idx_cust_addr_customer" ON "customer_addresses" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_cust_addr_tenant" ON "customer_addresses" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_discounts_store_code" ON "discounts" ("store_id", upper("code"));
CREATE INDEX IF NOT EXISTS "idx_discounts_tenant" ON "discounts" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_email" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "idx_users_tenant" ON "users" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_sessions_user" ON "sessions" ("user_id");

-- Denormalized tenant_id must always match the owning store's tenant (older seeds got this wrong).
UPDATE "products" t SET "tenant_id" = s."tenant_id" FROM "stores" s WHERE t."store_id" = s."id" AND t."tenant_id" <> s."tenant_id";
UPDATE "collections" t SET "tenant_id" = s."tenant_id" FROM "stores" s WHERE t."store_id" = s."id" AND t."tenant_id" <> s."tenant_id";
UPDATE "carts" t SET "tenant_id" = s."tenant_id" FROM "stores" s WHERE t."store_id" = s."id" AND t."tenant_id" <> s."tenant_id";
UPDATE "orders" t SET "tenant_id" = s."tenant_id" FROM "stores" s WHERE t."store_id" = s."id" AND t."tenant_id" <> s."tenant_id";
UPDATE "customers" t SET "tenant_id" = s."tenant_id" FROM "stores" s WHERE t."store_id" = s."id" AND t."tenant_id" <> s."tenant_id";
UPDATE "discounts" t SET "tenant_id" = s."tenant_id" FROM "stores" s WHERE t."store_id" = s."id" AND t."tenant_id" <> s."tenant_id";
UPDATE "product_variants" v SET "tenant_id" = p."tenant_id" FROM "products" p WHERE v."product_id" = p."id" AND v."tenant_id" <> p."tenant_id";
UPDATE "collection_products" cp SET "tenant_id" = c."tenant_id" FROM "collections" c WHERE cp."collection_id" = c."id" AND cp."tenant_id" <> c."tenant_id";
UPDATE "order_items" oi SET "tenant_id" = o."tenant_id" FROM "orders" o WHERE oi."order_id" = o."id" AND oi."tenant_id" <> o."tenant_id";
UPDATE "customer_addresses" ca SET "tenant_id" = c."tenant_id" FROM "customers" c WHERE ca."customer_id" = c."id" AND ca."tenant_id" <> c."tenant_id";
