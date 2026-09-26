"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schema = exports.cartItemsRelations = exports.cartsRelations = exports.productVariantsRelations = exports.productsRelations = exports.storesRelations = exports.tenantsRelations = exports.cartItems = exports.carts = exports.productVariants = exports.products = exports.stores = exports.tenants = void 0;
exports.createDbClient = createDbClient;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = require("postgres");
exports.tenants = (0, pg_core_1.pgTable)('tenants', {
    id: (0, pg_core_1.text)('id').primaryKey().notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    defaultCurrency: (0, pg_core_1.text)('default_currency').default('PKR').notNull(),
    defaultLocale: (0, pg_core_1.text)('default_locale').default('en').notNull(),
    status: (0, pg_core_1.text)('status').default('active').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.stores = (0, pg_core_1.pgTable)('stores', {
    id: (0, pg_core_1.text)('id').primaryKey().notNull(),
    tenantId: (0, pg_core_1.text)('tenant_id').references(() => exports.tenants.id, { onDelete: 'cascade' }).notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    slug: (0, pg_core_1.text)('slug').notNull().unique(),
    currency: (0, pg_core_1.text)('currency').default('PKR').notNull(),
    defaultLocale: (0, pg_core_1.text)('default_locale').default('en').notNull(),
    supportedLocales: (0, pg_core_1.text)('supported_locales').array().default(['en']).notNull(),
    timezone: (0, pg_core_1.text)('timezone').default('Asia/Karachi').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
exports.products = (0, pg_core_1.pgTable)('products', {
    id: (0, pg_core_1.text)('id').primaryKey().notNull(),
    tenantId: (0, pg_core_1.text)('tenant_id').references(() => exports.tenants.id, { onDelete: 'cascade' }).notNull(),
    storeId: (0, pg_core_1.text)('store_id').references(() => exports.stores.id, { onDelete: 'cascade' }).notNull(),
    title: (0, pg_core_1.text)('title').notNull(),
    slug: (0, pg_core_1.text)('slug').notNull(),
    description: (0, pg_core_1.text)('description'),
    isPublished: (0, pg_core_1.boolean)('is_published').default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)('idx_products_store_slug').on(table.storeId, table.slug),
    (0, pg_core_1.index)('idx_products_tenant').on(table.tenantId),
]);
exports.productVariants = (0, pg_core_1.pgTable)('product_variants', {
    id: (0, pg_core_1.text)('id').primaryKey().notNull(),
    tenantId: (0, pg_core_1.text)('tenant_id').references(() => exports.tenants.id, { onDelete: 'cascade' }).notNull(),
    productId: (0, pg_core_1.text)('product_id').references(() => exports.products.id, { onDelete: 'cascade' }).notNull(),
    title: (0, pg_core_1.text)('title').default('Default Title').notNull(),
    sku: (0, pg_core_1.text)('sku').notNull(),
    priceMinor: (0, pg_core_1.integer)('price_minor').notNull(),
    compareAtPriceMinor: (0, pg_core_1.integer)('compare_at_price_minor'),
    stock: (0, pg_core_1.integer)('stock').default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)('idx_variants_product').on(table.productId),
    (0, pg_core_1.index)('idx_variants_tenant').on(table.tenantId),
]);
exports.carts = (0, pg_core_1.pgTable)('carts', {
    id: (0, pg_core_1.text)('id').primaryKey().notNull(),
    tenantId: (0, pg_core_1.text)('tenant_id').references(() => exports.tenants.id, { onDelete: 'cascade' }).notNull(),
    storeId: (0, pg_core_1.text)('store_id').references(() => exports.stores.id, { onDelete: 'cascade' }).notNull(),
    currency: (0, pg_core_1.text)('currency').default('PKR').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)('idx_carts_store').on(table.storeId),
    (0, pg_core_1.index)('idx_carts_tenant').on(table.tenantId),
]);
exports.cartItems = (0, pg_core_1.pgTable)('cart_items', {
    id: (0, pg_core_1.text)('id').primaryKey().notNull(),
    cartId: (0, pg_core_1.text)('cart_id').references(() => exports.carts.id, { onDelete: 'cascade' }).notNull(),
    variantId: (0, pg_core_1.text)('variant_id').references(() => exports.productVariants.id, { onDelete: 'cascade' }).notNull(),
    quantity: (0, pg_core_1.integer)('quantity').default(1).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)('idx_cart_items_cart').on(table.cartId),
    (0, pg_core_1.index)('idx_cart_items_variant').on(table.variantId),
]);
exports.tenantsRelations = (0, drizzle_orm_1.relations)(exports.tenants, ({ many }) => ({
    stores: many(exports.stores),
}));
exports.storesRelations = (0, drizzle_orm_1.relations)(exports.stores, ({ one, many }) => ({
    tenant: one(exports.tenants, {
        fields: [exports.stores.tenantId],
        references: [exports.tenants.id],
    }),
    products: many(exports.products),
    carts: many(exports.carts),
}));
exports.productsRelations = (0, drizzle_orm_1.relations)(exports.products, ({ one, many }) => ({
    store: one(exports.stores, {
        fields: [exports.products.storeId],
        references: [exports.stores.id],
    }),
    variants: many(exports.productVariants),
}));
exports.productVariantsRelations = (0, drizzle_orm_1.relations)(exports.productVariants, ({ one }) => ({
    product: one(exports.products, {
        fields: [exports.productVariants.productId],
        references: [exports.products.id],
    }),
}));
exports.cartsRelations = (0, drizzle_orm_1.relations)(exports.carts, ({ one, many }) => ({
    store: one(exports.stores, {
        fields: [exports.carts.storeId],
        references: [exports.stores.id],
    }),
    items: many(exports.cartItems),
}));
exports.cartItemsRelations = (0, drizzle_orm_1.relations)(exports.cartItems, ({ one }) => ({
    cart: one(exports.carts, {
        fields: [exports.cartItems.cartId],
        references: [exports.carts.id],
    }),
    variant: one(exports.productVariants, {
        fields: [exports.cartItems.variantId],
        references: [exports.productVariants.id],
    }),
}));
exports.schema = {
    tenants: exports.tenants,
    stores: exports.stores,
    products: exports.products,
    productVariants: exports.productVariants,
    carts: exports.carts,
    cartItems: exports.cartItems,
    tenantsRelations: exports.tenantsRelations,
    storesRelations: exports.storesRelations,
    productsRelations: exports.productsRelations,
    productVariantsRelations: exports.productVariantsRelations,
    cartsRelations: exports.cartsRelations,
    cartItemsRelations: exports.cartItemsRelations,
};
function createDbClient(connectionString) {
    const isCloud = connectionString.includes('neon.tech') || connectionString.includes('sslmode=require');
    const client = (0, postgres_1.default)(connectionString, {
        max: 20,
        idle_timeout: 30,
        connect_timeout: 10,
        ssl: isCloud ? 'require' : undefined,
    });
    return (0, postgres_js_1.drizzle)(client, { schema: exports.schema });
}
__exportStar(require("drizzle-orm"), exports);
//# sourceMappingURL=index.js.map