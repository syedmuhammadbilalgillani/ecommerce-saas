-- 0006: Per-tenant Cloudinary credentials for image uploads (secret stored encrypted)
CREATE TABLE IF NOT EXISTS "tenant_cloudinary" (
  "tenant_id" text PRIMARY KEY NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "cloud_name" text NOT NULL,
  "api_key" text NOT NULL,
  "api_secret_encrypted" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
