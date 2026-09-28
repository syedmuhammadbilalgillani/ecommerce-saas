-- 0005: Structured variant options (Shopify-style option1/2/3) and a product images table
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "option1" text;
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "option2" text;
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "option3" text;

CREATE TABLE IF NOT EXISTS "product_images" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "alt_text" text,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_product_images_product" ON "product_images" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_product_images_tenant" ON "product_images" ("tenant_id");
