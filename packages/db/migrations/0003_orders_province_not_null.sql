-- 0003: orders.shipping_province is NOT NULL (default 'Pakistan') in the Drizzle schema, but some
-- databases created it nullable. Backfill any gaps, then enforce it so both sides agree.
UPDATE "orders" SET "shipping_province" = 'Pakistan' WHERE "shipping_province" IS NULL;
ALTER TABLE "orders" ALTER COLUMN "shipping_province" SET DEFAULT 'Pakistan';
ALTER TABLE "orders" ALTER COLUMN "shipping_province" SET NOT NULL;
