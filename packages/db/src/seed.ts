import 'dotenv/config';
import { createDbClient, tenants, stores, products, productVariants } from './index.ts';

async function seed() {
  const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecommerce_saas';
  const db = createDbClient(url);

  console.log('Seeding initial demo tenant & products...');

  await db.insert(tenants).values({
    id: 'ten_pilot_01',
    name: 'Outfitters Pakistan',
    defaultCurrency: 'PKR',
    defaultLocale: 'en',
    status: 'active',
  }).onConflictDoNothing();

  await db.insert(stores).values({
    id: 'store_default',
    tenantId: 'ten_pilot_01',
    name: 'Outfitters Official',
    slug: 'outfitters-pk',
    currency: 'PKR',
    defaultLocale: 'en',
    supportedLocales: ['en', 'ur'],
    timezone: 'Asia/Karachi',
  }).onConflictDoNothing();

  await db.insert(products).values({
    id: 'prod_01',
    tenantId: 'ten_pilot_01',
    storeId: 'store_default',
    title: 'Essential Crewneck T-Shirt',
    slug: 'essential-crewneck-tshirt',
    description: '100% premium combed cotton t-shirt.',
    isPublished: true,
  }).onConflictDoNothing();

  await db.insert(productVariants).values([
    {
      id: 'var_01',
      tenantId: 'ten_pilot_01',
      productId: 'prod_01',
      title: 'Black / Medium',
      sku: 'OUTF-TSHIRT-BLK-M',
      priceMinor: 249000, // PKR 2,490
      stock: 50,
    },
    {
      id: 'var_02',
      tenantId: 'ten_pilot_01',
      productId: 'prod_01',
      title: 'Black / Large',
      sku: 'OUTF-TSHIRT-BLK-L',
      priceMinor: 249000,
      stock: 35,
    },
  ]).onConflictDoNothing();

  console.log('✅ Demo seed completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
