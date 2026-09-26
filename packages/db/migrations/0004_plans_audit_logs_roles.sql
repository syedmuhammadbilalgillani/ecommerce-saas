-- 0004: Tenant subscription plans, audit logs table, and platform RBAC roles
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "plan" text NOT NULL DEFAULT 'starter';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "plan_price_minor" integer NOT NULL DEFAULT 500000;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "plan_interval" text NOT NULL DEFAULT 'month';

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "platform_role" text DEFAULT 'super_admin';

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "actor_id" text NOT NULL,
  "actor_email" text NOT NULL,
  "actor_role" text NOT NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_actor" ON "audit_logs" ("actor_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_target" ON "audit_logs" ("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created" ON "audit_logs" ("created_at" DESC);
