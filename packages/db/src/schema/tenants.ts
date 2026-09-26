import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  defaultCurrency: text('default_currency').default('PKR').notNull(), // ISO 4217: PKR, AED, SAR, USD
  defaultLocale: text('default_locale').default('en').notNull(),       // e.g. 'en', 'ur', 'ar'
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const stores = pgTable('stores', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  currency: text('currency').default('PKR').notNull(),               // Primary store currency
  defaultLocale: text('default_locale').default('en').notNull(),     // Primary language: 'en', 'ur', 'ar'
  supportedLocales: text('supported_locales').array().default(['en']).notNull(), // e.g. ['en', 'ur']
  timezone: text('timezone').default('Asia/Karachi').notNull(),      // e.g. 'Asia/Karachi', 'Asia/Dubai'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
