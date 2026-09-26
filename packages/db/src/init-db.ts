import postgres from 'postgres';
import 'dotenv/config';

async function initDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ ERROR: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  console.log('Connecting to Neon PostgreSQL database...');
  const sql = postgres(url, {
    ssl: 'require',
    connect_timeout: 15,
  });

  try {
    console.log('Creating tables and indexes in Neon...');

    // 1. Tenants Table
    await sql`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "default_currency" text DEFAULT 'PKR' NOT NULL,
        "default_locale" text DEFAULT 'en' NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;

    // 2. Stores Table
    await sql`
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
    `;

    // 3. Categories Table (Shopify Standard Taxonomy Tree)
    await sql`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "full_name" text NOT NULL,
        "parent_id" text REFERENCES "categories"("id") ON DELETE SET NULL,
        "level" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;

    // 4. Merchandising Collections Table
    await sql`
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
    `;

    // 5. Products Table
    await sql`
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
    `;

    // Alter products table in case it was created previously without new taxonomy columns
    await sql`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category_id" text REFERENCES "categories"("id") ON DELETE SET NULL;`;
    await sql`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "product_type" text;`;
    await sql`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "vendor" text;`;
    await sql`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT ARRAY[]::text[] NOT NULL;`;
    await sql`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "options" jsonb;`;

    // 6. Collection Products Join Table
    await sql`
      CREATE TABLE IF NOT EXISTS "collection_products" (
        "id" text PRIMARY KEY NOT NULL,
        "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "collection_id" text NOT NULL REFERENCES "collections"("id") ON DELETE CASCADE,
        "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "position" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;

    // 7. Product Variants Table
    await sql`
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
    `;

    // 8. Carts Table
    await sql`
      CREATE TABLE IF NOT EXISTS "carts" (
        "id" text PRIMARY KEY NOT NULL,
        "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "store_id" text NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
        "currency" text DEFAULT 'PKR' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;

    // 9. Cart Items Table
    await sql`
      CREATE TABLE IF NOT EXISTS "cart_items" (
        "id" text PRIMARY KEY NOT NULL,
        "cart_id" text NOT NULL REFERENCES "carts"("id") ON DELETE CASCADE,
        "variant_id" text NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
        "quantity" integer DEFAULT 1 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;

    // 10. Orders Table
    await sql`
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
    `;

    // 11. Order Items Table
    await sql`
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
    `;

    // 12. Customers Table (Shopify CRM)
    await sql`
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
    `;

    // 13. Customer Addresses Table
    await sql`
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
    `;

    // 14. Discounts Table (Shopify Rules Engine)
    await sql`
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
    `;

    // Alter orders table to link customer and discounts
    await sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_id" text REFERENCES "customers"("id") ON DELETE SET NULL;`;
    await sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_code" text;`;
    await sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_minor" integer DEFAULT 0 NOT NULL;`;

    // Courier columns were added to the schema after some databases were first created
    await sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courier_name" text;`;
    await sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courier_tracking_number" text;`;
    await sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "courier_status" text;`;

    // Secret required to view an order on the storefront (prevents order-id guessing)
    await sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "access_token" text;`;

    // 15. Users & Sessions (merchant + platform admin auth)
    await sql`
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
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "expires_at" timestamp with time zone NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_email" ON "users" ("email");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_users_tenant" ON "users" ("tenant_id");`;

    // Per-store order numbering (replaces the API's in-memory counter, which reset on restart).
    await sql`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "next_order_number" integer DEFAULT 1001 NOT NULL;`;
    await sql`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "whatsapp_phone" text;`;
    // Start each store after its highest existing "PF-<n>" number so nothing is reused.
    await sql`
      UPDATE "stores" s SET "next_order_number" = m.next
      FROM (
        SELECT "store_id", MAX(substring("order_number" FROM '[0-9]+$')::int) + 1 AS next
        FROM "orders" WHERE "order_number" ~ '[0-9]+$' GROUP BY "store_id"
      ) m
      WHERE s."id" = m."store_id" AND s."next_order_number" < m.next;
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "uq_orders_store_number" ON "orders" ("store_id", "order_number");`;

    // Stock can never go negative, even if application code has a bug.
    await sql`
      DO $$ BEGIN
        ALTER TABLE "product_variants" ADD CONSTRAINT "chk_variants_stock_nonnegative" CHECK ("stock" >= 0);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `;
    await sql`CREATE INDEX IF NOT EXISTS "idx_sessions_user" ON "sessions" ("user_id");`;

    // Performance Indexes
    await sql`CREATE INDEX IF NOT EXISTS "idx_categories_parent" ON "categories" ("parent_id");`;
    await sql`DROP INDEX IF EXISTS "idx_collections_store_slug";`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "uq_collections_store_slug" ON "collections" ("store_id", "slug");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_collections_tenant" ON "collections" ("tenant_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_col_prod_collection" ON "collection_products" ("collection_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_col_prod_product" ON "collection_products" ("product_id");`;
    await sql`DROP INDEX IF EXISTS "idx_products_store_slug";`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "uq_products_store_slug" ON "products" ("store_id", "slug");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_products_tenant" ON "products" ("tenant_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_products_category" ON "products" ("category_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_variants_product" ON "product_variants" ("product_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_variants_tenant" ON "product_variants" ("tenant_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_carts_store" ON "carts" ("store_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_cart_items_cart" ON "cart_items" ("cart_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_orders_store" ON "orders" ("store_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_orders_tenant" ON "orders" ("tenant_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_orders_phone" ON "orders" ("customer_phone");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_orders_created" ON "orders" ("created_at");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_order_items_order" ON "order_items" ("order_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "idx_customers_store" ON "customers" ("store_id");`;
    await sql`DROP INDEX IF EXISTS "idx_customers_phone";`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "uq_customers_store_phone" ON "customers" ("store_id", "phone");`;
    await sql`DROP INDEX IF EXISTS "idx_discounts_store_code";`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "uq_discounts_store_code" ON "discounts" ("store_id", upper("code"));`;

    // Seed Standard Shopify Product Taxonomy Categories
    console.log('Seeding Standard Shopify Product Taxonomy Categories...');
    const standardCategories = [
      { id: 'cat_apparel', name: 'Apparel & Accessories', fullName: 'Apparel & Accessories', parentId: null, level: 0 },
      { id: 'cat_clothing', name: 'Clothing', fullName: 'Apparel & Accessories > Clothing', parentId: 'cat_apparel', level: 1 },
      { id: 'cat_tops', name: 'Shirts & Tops', fullName: 'Apparel & Accessories > Clothing > Shirts & Tops', parentId: 'cat_clothing', level: 2 },
      { id: 'cat_tshirts', name: 'T-Shirts', fullName: 'Apparel & Accessories > Clothing > Shirts & Tops > T-Shirts', parentId: 'cat_tops', level: 3 },
      { id: 'cat_shirts', name: 'Button-Down Shirts', fullName: 'Apparel & Accessories > Clothing > Shirts & Tops > Button-Down Shirts', parentId: 'cat_tops', level: 3 },
      { id: 'cat_outerwear', name: 'Outerwear', fullName: 'Apparel & Accessories > Clothing > Outerwear', parentId: 'cat_clothing', level: 2 },
      { id: 'cat_hoodies', name: 'Hoodies & Sweatshirts', fullName: 'Apparel & Accessories > Clothing > Outerwear > Hoodies & Sweatshirts', parentId: 'cat_outerwear', level: 3 },
      { id: 'cat_bottoms', name: 'Bottoms', fullName: 'Apparel & Accessories > Clothing > Bottoms', parentId: 'cat_clothing', level: 2 },
      { id: 'cat_pants', name: 'Pants & Trousers', fullName: 'Apparel & Accessories > Clothing > Bottoms > Pants & Trousers', parentId: 'cat_bottoms', level: 3 },
      { id: 'cat_shoes', name: 'Shoes & Footwear', fullName: 'Apparel & Accessories > Shoes & Footwear', parentId: 'cat_apparel', level: 1 },
      { id: 'cat_sneakers', name: 'Sneakers & Athletic Shoes', fullName: 'Apparel & Accessories > Shoes & Footwear > Sneakers', parentId: 'cat_shoes', level: 2 },
    ];

    for (const cat of standardCategories) {
      await sql`
        INSERT INTO "categories" ("id", "name", "full_name", "parent_id", "level")
        VALUES (${cat.id}, ${cat.name}, ${cat.fullName}, ${cat.parentId}, ${cat.level})
        ON CONFLICT ("id") DO UPDATE SET
          "name" = EXCLUDED."name",
          "full_name" = EXCLUDED."full_name",
          "level" = EXCLUDED."level";
      `;
    }

    // Ensure default tenants and stores exist first for FK constraints
    console.log('Ensuring default tenant and store exist...');
    await sql`
      INSERT INTO "tenants" ("id", "name", "default_currency", "default_locale", "status")
      VALUES ('ten_pilot_01', 'Outfitters Pakistan', 'PKR', 'en', 'active')
      ON CONFLICT ("id") DO NOTHING;
    `;

    await sql`
      INSERT INTO "stores" ("id", "tenant_id", "name", "slug", "currency", "default_locale")
      VALUES ('store_default', 'ten_pilot_01', 'Outfitters Official', 'outfitters-pk', 'PKR', 'en')
      ON CONFLICT ("id") DO NOTHING;
    `;

    // Seed default merchandising collections
    console.log('Seeding default collections...');
    const defaultCollections = [
      { id: 'col_summer', tenantId: 'ten_pilot_01', storeId: 'store_default', title: 'Summer 2026 Collection', slug: 'summer-2026', description: 'Lightweight linen & breathable cottons for peak summer.' },
      { id: 'col_mens', tenantId: 'ten_pilot_01', storeId: 'store_default', title: "Men's Apparel", slug: 'mens-apparel', description: 'Curated menswear essentials handcrafted for comfort.' },
      { id: 'col_bestsellers', tenantId: 'ten_pilot_01', storeId: 'store_default', title: 'Best Sellers', slug: 'best-sellers', description: 'Most-ordered pieces across Pakistan.' },
    ];

    for (const col of defaultCollections) {
      await sql`
        INSERT INTO "collections" ("id", "tenant_id", "store_id", "title", "slug", "description", "collection_type", "is_published")
        VALUES (${col.id}, ${col.tenantId}, ${col.storeId}, ${col.title}, ${col.slug}, ${col.description}, 'manual', true)
        ON CONFLICT ("id") DO NOTHING;
      `;
    }

    // Seed default Shopify-standard discounts
    console.log('Seeding default Shopify-standard discounts...');
    const defaultDiscounts = [
      {
        id: 'disc_welcome10',
        tenantId: 'ten_pilot_01',
        storeId: 'store_default',
        code: 'WELCOME10',
        title: '10% Off Welcome Promotion',
        description: 'New customer introductory 10% discount',
        discountType: 'percentage',
        value: 10,
        appliesTo: 'all_products',
        minRequirementType: 'none',
        minSubtotalMinor: 0,
        usageLimit: 500,
        timesUsed: 14,
        isActive: true,
      },
      {
        id: 'disc_flat500',
        tenantId: 'ten_pilot_01',
        storeId: 'store_default',
        code: 'FLAT500',
        title: 'Rs. 500 Flat Savings',
        description: 'Rs. 500 off on carts over Rs. 3,000',
        discountType: 'fixed_amount',
        value: 50000, // 500 PKR
        appliesTo: 'all_products',
        minRequirementType: 'min_subtotal',
        minSubtotalMinor: 300000, // 3,000 PKR
        usageLimit: 200,
        timesUsed: 38,
        isActive: true,
      },
      {
        id: 'disc_freeship',
        tenantId: 'ten_pilot_01',
        storeId: 'store_default',
        code: 'FREESHIP',
        title: 'Free Standard Shipping across Pakistan',
        description: 'Free courier delivery on orders above Rs. 2,500',
        discountType: 'free_shipping',
        value: 0,
        appliesTo: 'all_products',
        minRequirementType: 'min_subtotal',
        minSubtotalMinor: 250000, // 2,500 PKR
        usageLimit: 1000,
        timesUsed: 89,
        isActive: true,
      },
    ];

    for (const d of defaultDiscounts) {
      await sql`
        INSERT INTO "discounts" (
          "id", "tenant_id", "store_id", "code", "title", "description",
          "discount_type", "value", "applies_to", "min_requirement_type",
          "min_subtotal_minor", "usage_limit", "times_used", "is_active"
        )
        VALUES (
          ${d.id}, ${d.tenantId}, ${d.storeId}, ${d.code}, ${d.title}, ${d.description},
          ${d.discountType}, ${d.value}, ${d.appliesTo}, ${d.minRequirementType},
          ${d.minSubtotalMinor}, ${d.usageLimit}, ${d.timesUsed}, ${d.isActive}
        )
        ON CONFLICT ("id") DO NOTHING;
      `;
    }

    // Seed sample customers for CRM
    console.log('Seeding sample customers for CRM directory...');
    const defaultCustomers = [
      {
        id: 'cust_hamza_01',
        tenantId: 'ten_pilot_01',
        storeId: 'store_default',
        firstName: 'Hamza',
        lastName: 'Khan',
        phone: '+923001234567',
        email: 'hamza.khan@gmail.com',
        ordersCount: 3,
        totalSpentMinor: 1450000, // 14,500 PKR
        state: 'enabled',
        tags: ['vip', 'repeat_buyer', 'lahore'],
        notes: 'High-value customer. Prefers Trax Courier delivery.',
      },
      {
        id: 'cust_ayesha_02',
        tenantId: 'ten_pilot_01',
        storeId: 'store_default',
        firstName: 'Ayesha',
        lastName: 'Tariq',
        phone: '+923219876543',
        email: 'ayesha.tariq@yahoo.com',
        ordersCount: 1,
        totalSpentMinor: 385000, // 3,850 PKR
        state: 'enabled',
        tags: ['karachi', 'cod_verified'],
        notes: 'Verified via WhatsApp before first shipment.',
      },
      {
        id: 'cust_bilal_03',
        tenantId: 'ten_pilot_01',
        storeId: 'store_default',
        firstName: 'Bilal',
        lastName: 'Ahmed',
        phone: '+923335557799',
        email: 'bilal.ahmed@outlook.com',
        ordersCount: 2,
        totalSpentMinor: 890000, // 8,900 PKR
        state: 'enabled',
        tags: ['islamabad', 'frequent_buyer'],
        notes: 'Reliable customer. Always pays exact cash.',
      },
    ];

    for (const c of defaultCustomers) {
      await sql`
        INSERT INTO "customers" (
          "id", "tenant_id", "store_id", "first_name", "last_name",
          "phone", "email", "orders_count", "total_spent_minor", "state", "tags", "notes"
        )
        VALUES (
          ${c.id}, ${c.tenantId}, ${c.storeId}, ${c.firstName}, ${c.lastName},
          ${c.phone}, ${c.email}, ${c.ordersCount}, ${c.totalSpentMinor}, ${c.state}, ${c.tags}, ${c.notes}
        )
        ON CONFLICT ("id") DO NOTHING;
      `;
    }

    // Repair denormalized tenant_id so it always matches the owning store's tenant.
    // Earlier seeds wrote a different tenant id than the store's real owner.
    console.log('Repairing tenant_id on store-scoped rows...');
    for (const table of ['products', 'collections', 'carts', 'orders', 'customers', 'discounts']) {
      await sql`
        UPDATE ${sql(table)} AS t SET "tenant_id" = s."tenant_id"
        FROM "stores" s
        WHERE t."store_id" = s."id" AND t."tenant_id" <> s."tenant_id";
      `;
    }
    await sql`
      UPDATE "product_variants" v SET "tenant_id" = p."tenant_id"
      FROM "products" p WHERE v."product_id" = p."id" AND v."tenant_id" <> p."tenant_id";
    `;
    await sql`
      UPDATE "collection_products" cp SET "tenant_id" = c."tenant_id"
      FROM "collections" c WHERE cp."collection_id" = c."id" AND cp."tenant_id" <> c."tenant_id";
    `;
    await sql`
      UPDATE "order_items" oi SET "tenant_id" = o."tenant_id"
      FROM "orders" o WHERE oi."order_id" = o."id" AND oi."tenant_id" <> o."tenant_id";
    `;
    await sql`
      UPDATE "customer_addresses" ca SET "tenant_id" = c."tenant_id"
      FROM "customers" c WHERE ca."customer_id" = c."id" AND ca."tenant_id" <> c."tenant_id";
    `;

    console.log('✅ SUCCESS! All tables, indexes, Standard Taxonomy, Collections, Discounts, and Customers are initialized.');
    await sql.end();
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Table creation failed:');
    console.error(err.message || err);
    await sql.end();
    process.exit(1);
  }
}

initDatabase();
