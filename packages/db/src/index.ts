import { pgTable, text, timestamp, boolean, integer, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// ----------------------------------------------------
// 1. Tenants & Stores Tables
// ----------------------------------------------------
export const tenants = pgTable('tenants', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  defaultCurrency: text('default_currency').default('PKR').notNull(),
  defaultLocale: text('default_locale').default('en').notNull(),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const stores = pgTable('stores', {
  id: text('id').primaryKey().notNull(),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  currency: text('currency').default('PKR').notNull(),
  defaultLocale: text('default_locale').default('en').notNull(),
  supportedLocales: text('supported_locales').array().default(['en']).notNull(),
  timezone: text('timezone').default('Asia/Karachi').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----------------------------------------------------
// 2. Standard Product Taxonomy (Shopify-Style Global Categories)
// ----------------------------------------------------
export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey().notNull(), // e.g. 'cat_tshirts'
    name: text('name').notNull(),          // e.g. 'T-Shirts'
    fullName: text('full_name').notNull(),  // e.g. 'Apparel & Accessories > Clothing > Tops > T-Shirts'
    parentId: text('parent_id'),           // Self-referencing FK
    level: integer('level').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_categories_parent').on(table.parentId),
  ]
);

// ----------------------------------------------------
// 3. Merchandising Collections & Join Table
// ----------------------------------------------------
export const collections = pgTable(
  'collections',
  {
    id: text('id').primaryKey().notNull(), // e.g. 'col_summer_2026'
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    storeId: text('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    collectionType: text('collection_type').default('manual').notNull(), // 'manual' | 'smart'
    rules: jsonb('rules'),
    isPublished: boolean('is_published').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_collections_store_slug').on(table.storeId, table.slug),
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

// ----------------------------------------------------
// 4. Products & Variants Tables
// ----------------------------------------------------
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
    uniqueIndex('uq_products_store_slug').on(table.storeId, table.slug),
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

// ----------------------------------------------------
// 5. Cart & Cart Items Tables
// ----------------------------------------------------
export const carts = pgTable(
  'carts',
  {
    id: text('id').primaryKey().notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    storeId: text('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
    currency: text('currency').default('PKR').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_carts_store').on(table.storeId),
    index('idx_carts_tenant').on(table.tenantId),
  ]
);

export const cartItems = pgTable(
  'cart_items',
  {
    id: text('id').primaryKey().notNull(),
    cartId: text('cart_id').references(() => carts.id, { onDelete: 'cascade' }).notNull(),
    variantId: text('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }).notNull(),
    quantity: integer('quantity').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_cart_items_cart').on(table.cartId),
    index('idx_cart_items_variant').on(table.variantId),
  ]
);

// ----------------------------------------------------
// 6. Orders & Order Items Tables
// ----------------------------------------------------
export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey().notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    storeId: text('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
    orderNumber: text('order_number').notNull(),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull(),
    customerEmail: text('customer_email'),
    shippingAddressLine1: text('shipping_address_line1').notNull(),
    shippingAddressLine2: text('shipping_address_line2'),
    shippingCity: text('shipping_city').notNull(),
    shippingProvince: text('shipping_province').default('Pakistan').notNull(),
    shippingPostalCode: text('shipping_postal_code'),
    paymentMethod: text('payment_method').default('cod').notNull(),
    financialStatus: text('financial_status').default('pending').notNull(),
    fulfillmentStatus: text('fulfillment_status').default('unfulfilled').notNull(),
    orderStatus: text('order_status').default('open').notNull(),
    courierName: text('courier_name'),
    courierTrackingNumber: text('courier_tracking_number'),
    courierStatus: text('courier_status'),
    currency: text('currency').default('PKR').notNull(),
    customerId: text('customer_id'),
    discountCode: text('discount_code'),
    discountMinor: integer('discount_minor').default(0).notNull(),
    subtotalMinor: integer('subtotal_minor').notNull(),
    shippingFeeMinor: integer('shipping_fee_minor').default(0).notNull(),
    totalMinor: integer('total_minor').notNull(),
    notes: text('notes'),
    // Secret handed to the shopper at checkout; required to view the order on the storefront.
    accessToken: text('access_token'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_orders_store').on(table.storeId),
    index('idx_orders_tenant').on(table.tenantId),
    index('idx_orders_phone').on(table.customerPhone),
    index('idx_orders_created').on(table.createdAt),
  ]
);

export const orderItems = pgTable(
  'order_items',
  {
    id: text('id').primaryKey().notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
    variantId: text('variant_id'),
    productId: text('product_id'),
    title: text('title').notNull(),
    variantTitle: text('variant_title').notNull(),
    sku: text('sku').notNull(),
    unitPriceMinor: integer('unit_price_minor').notNull(),
    quantity: integer('quantity').default(1).notNull(),
    totalMinor: integer('total_minor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_order_items_order').on(table.orderId),
    index('idx_order_items_tenant').on(table.tenantId),
  ]
);

// ----------------------------------------------------
// 7. Customers & Customer Addresses (Shopify CRM)
// ----------------------------------------------------
export const customers = pgTable(
  'customers',
  {
    id: text('id').primaryKey().notNull(), // e.g. 'cust_923001234567'
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    storeId: text('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    email: text('email'),
    phone: text('phone').notNull(),
    ordersCount: integer('orders_count').default(0).notNull(),
    totalSpentMinor: integer('total_spent_minor').default(0).notNull(),
    state: text('state').default('enabled').notNull(), // 'enabled' | 'disabled'
    tags: text('tags').array().default([]).notNull(), // ['vip', 'wholesale', 'high_rto_risk']
    notes: text('notes'),
    defaultAddress: jsonb('default_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_customers_store').on(table.storeId),
    index('idx_customers_tenant').on(table.tenantId),
    uniqueIndex('uq_customers_store_phone').on(table.storeId, table.phone),
  ]
);

export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: text('id').primaryKey().notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'cascade' }).notNull(),
    name: text('name'),
    phone: text('phone'),
    address1: text('address1').notNull(),
    address2: text('address2'),
    city: text('city').notNull(),
    province: text('province').default('Pakistan').notNull(),
    postalCode: text('postal_code'),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_cust_addr_customer').on(table.customerId),
    index('idx_cust_addr_tenant').on(table.tenantId),
  ]
);

// ----------------------------------------------------
// 8. Discounts Table (Shopify Rules Engine)
// ----------------------------------------------------
export const discounts = pgTable(
  'discounts',
  {
    id: text('id').primaryKey().notNull(), // e.g. 'disc_welcome10'
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    storeId: text('store_id').references(() => stores.id, { onDelete: 'cascade' }).notNull(),
    code: text('code').notNull(), // e.g. 'WELCOME10'
    title: text('title').notNull(), // '10% Welcome Discount'
    description: text('description'),
    discountType: text('discount_type').notNull(), // 'percentage' | 'fixed_amount' | 'free_shipping'
    value: integer('value').notNull(), // percentage: 10 = 10%; fixed_amount: amount in minor units (e.g. 50000 = 500 PKR)
    appliesTo: text('applies_to').default('all_products').notNull(), // 'all_products' | 'specific_collections' | 'specific_products'
    entitledCollectionIds: text('entitled_collection_ids').array().default([]).notNull(),
    entitledProductIds: text('entitled_product_ids').array().default([]).notNull(),
    minRequirementType: text('min_requirement_type').default('none').notNull(), // 'none' | 'min_subtotal' | 'min_quantity'
    minSubtotalMinor: integer('min_subtotal_minor').default(0).notNull(),
    minQuantity: integer('min_quantity').default(0).notNull(),
    usageLimit: integer('usage_limit'), // null = unlimited
    timesUsed: integer('times_used').default(0).notNull(),
    oncePerCustomer: boolean('once_per_customer').default(false).notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).defaultNow().notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_discounts_store_code').on(table.storeId, sql`upper(${table.code})`),
    index('idx_discounts_tenant').on(table.tenantId),
  ]
);

// ----------------------------------------------------
// 9. Users & Sessions (Merchant + Platform Admin auth)
// ----------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey().notNull(),
    email: text('email').notNull(), // stored lowercased
    name: text('name'),
    passwordHash: text('password_hash').notNull(), // scrypt: "scrypt$<salt b64>$<hash b64>"
    role: text('role').notNull(), // 'merchant' | 'platform_admin'
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }), // null for platform admins
    status: text('status').default('active').notNull(), // 'active' | 'disabled'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_users_email').on(table.email),
    index('idx_users_tenant').on(table.tenantId),
  ]
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey().notNull(), // sha256 of the session token; the raw token is never stored
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_sessions_user').on(table.userId),
  ]
);

// ----------------------------------------------------
// 10. Relations
// ----------------------------------------------------
export const tenantsRelations = relations(tenants, ({ many }) => ({
  stores: many(stores),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [stores.tenantId],
    references: [tenants.id],
  }),
  products: many(products),
  collections: many(collections),
  carts: many(carts),
  orders: many(orders),
  customers: many(customers),
  discounts: many(discounts),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryHierarchy',
  }),
  children: many(categories, {
    relationName: 'categoryHierarchy',
  }),
  products: many(products),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  store: one(stores, {
    fields: [collections.storeId],
    references: [stores.id],
  }),
  collectionProducts: many(collectionProducts),
}));

export const collectionProductsRelations = relations(collectionProducts, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionProducts.collectionId],
    references: [collections.id],
  }),
  product: one(products, {
    fields: [collectionProducts.productId],
    references: [products.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, {
    fields: [products.storeId],
    references: [stores.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  collectionProducts: many(collectionProducts),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id],
  }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  store: one(stores, {
    fields: [carts.storeId],
    references: [stores.id],
  }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, {
    fields: [orders.storeId],
    references: [stores.id],
  }),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  store: one(stores, {
    fields: [customers.storeId],
    references: [stores.id],
  }),
  addresses: many(customerAddresses),
  orders: many(orders),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(customers, {
    fields: [customerAddresses.customerId],
    references: [customers.id],
  }),
}));

export const discountsRelations = relations(discounts, ({ one }) => ({
  store: one(stores, {
    fields: [discounts.storeId],
    references: [stores.id],
  }),
}));

// ----------------------------------------------------
// 11. Schema & Client Factory
// ----------------------------------------------------
export const schema = {
  tenants,
  stores,
  categories,
  collections,
  collectionProducts,
  products,
  productVariants,
  carts,
  cartItems,
  orders,
  orderItems,
  customers,
  customerAddresses,
  discounts,
  users,
  sessions,
  tenantsRelations,
  usersRelations,
  sessionsRelations,
  storesRelations,
  categoriesRelations,
  collectionsRelations,
  collectionProductsRelations,
  productsRelations,
  productVariantsRelations,
  cartsRelations,
  cartItemsRelations,
  ordersRelations,
  orderItemsRelations,
  customersRelations,
  customerAddressesRelations,
  discountsRelations,
};

export type Database = ReturnType<typeof createDbClient>;

export function createDbClient(connectionString: string) {
  const isCloud = connectionString.includes('neon.tech') || connectionString.includes('sslmode=require');

  const client = postgres(connectionString, {
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10,
    ssl: isCloud ? 'require' : undefined,
  });

  return drizzle(client, { schema });
}

// Re-export core Drizzle utilities
export * from 'drizzle-orm';

// Password hashing shared by the API and CLI scripts
export * from './password.ts';
