import { pgTable, text, timestamp, boolean, integer, index, jsonb } from 'drizzle-orm/pg-core';
import { stores, tenants } from './tenants';

export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    fullName: text('full_name').notNull(),
    parentId: text('parent_id'),
    level: integer('level').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_categories_parent').on(table.parentId),
  ]
);

export const collections = pgTable(
  'collections',
  {
    id: text('id').primaryKey().notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    storeId: text('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    collectionType: text('collection_type').default('manual').notNull(),
    rules: jsonb('rules'),
    isPublished: boolean('is_published').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_collections_store_slug').on(table.storeId, table.slug),
    index('idx_collections_tenant').on(table.tenantId),
  ]
);

export const collectionProducts = pgTable(
  'collection_products',
  {
    id: text('id').primaryKey().notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    collectionId: text('collection_id').references(() => collections.id, { onDelete: 'cascade' }).notNull(),
    productId: text('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
    position: integer('position').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_col_prod_collection').on(table.collectionId),
    index('idx_col_prod_product').on(table.productId),
    index('idx_col_prod_tenant').on(table.tenantId),
  ]
);

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey().notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    storeId: text('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    productType: text('product_type'),
    vendor: text('vendor'),
    tags: text('tags').array().default([]).notNull(),
    options: jsonb('options').$type<Array<{ name: string; values: string[] }>>(),
    isPublished: boolean('is_published').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_products_store_slug').on(table.storeId, table.slug),
    index('idx_products_tenant').on(table.tenantId),
    index('idx_products_category').on(table.categoryId),
  ]
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: text('id').primaryKey().notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    productId: text('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
    title: text('title').default('Default Title').notNull(),
    sku: text('sku').notNull(),
    priceMinor: integer('price_minor').notNull(),
    compareAtPriceMinor: integer('compare_at_price_minor'),
    stock: integer('stock').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_variants_product').on(table.productId),
    index('idx_variants_tenant').on(table.tenantId),
  ]
);
