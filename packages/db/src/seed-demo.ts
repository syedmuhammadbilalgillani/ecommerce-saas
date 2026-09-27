/**
 * Loads the demo tenant/store (Outfitters) with sample products, collections, discounts and
 * customers for local development. Never run this against production data.
 *
 *   pnpm db:seed
 *
 * Idempotent: rows that already exist are left untouched.
 */
import './load-env';
import postgres from 'postgres';

const TENANT = 'ten_pilot_01';
const STORE = 'store_default';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to load demo data while NODE_ENV=production.');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is missing');
  const isCloud = url.includes('neon.tech') || url.includes('sslmode=require');
  const sql = postgres(url, { ssl: isCloud ? 'require' : false, max: 1 });

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO tenants (id, name, default_currency, default_locale, status)
      VALUES (${TENANT}, 'Outfitters Pakistan', 'PKR', 'en', 'active')
      ON CONFLICT (id) DO NOTHING`;
    await tx`
      INSERT INTO stores (id, tenant_id, name, slug, currency, default_locale, supported_locales, timezone)
      VALUES (${STORE}, ${TENANT}, 'Outfitters Official', 'outfitters-pk', 'PKR', 'en', ARRAY['en','ur'], 'Asia/Karachi')
      ON CONFLICT (id) DO NOTHING`;

    await tx`
      INSERT INTO products (id, tenant_id, store_id, category_id, title, slug, description, is_published)
      VALUES ('prod_01', ${TENANT}, ${STORE}, 'cat_tshirts', 'Essential Crewneck T-Shirt', 'essential-crewneck-tshirt',
              '100% premium combed cotton t-shirt.', true)
      ON CONFLICT (id) DO NOTHING`;
    await tx`
      INSERT INTO product_variants (id, tenant_id, product_id, title, sku, price_minor, stock) VALUES
        ('var_01', ${TENANT}, 'prod_01', 'Black / Medium', 'OUTF-TSHIRT-BLK-M', 249000, 50),
        ('var_02', ${TENANT}, 'prod_01', 'Black / Large',  'OUTF-TSHIRT-BLK-L', 249000, 35)
      ON CONFLICT (id) DO NOTHING`;

    await tx`
      INSERT INTO collections (id, tenant_id, store_id, title, slug, description, collection_type, is_published) VALUES
        ('col_summer',      ${TENANT}, ${STORE}, 'Summer 2026 Collection', 'summer-2026',  'Lightweight linen & breathable cottons for peak summer.', 'manual', true),
        ('col_mens',        ${TENANT}, ${STORE}, 'Men''s Apparel',          'mens-apparel', 'Curated menswear essentials handcrafted for comfort.',     'manual', true),
        ('col_bestsellers', ${TENANT}, ${STORE}, 'Best Sellers',           'best-sellers', 'Most-ordered pieces across Pakistan.',                     'manual', true)
      ON CONFLICT (id) DO NOTHING`;

    await tx`
      INSERT INTO discounts (id, tenant_id, store_id, code, title, description, discount_type, value,
                             min_requirement_type, min_subtotal_minor, usage_limit) VALUES
        ('disc_welcome10', ${TENANT}, ${STORE}, 'WELCOME10', '10% Off Welcome Promotion', 'New customer introductory 10% discount',
         'percentage', 10, 'none', 0, 500),
        ('disc_flat500', ${TENANT}, ${STORE}, 'FLAT500', 'Rs. 500 Flat Savings', 'Rs. 500 off on carts over Rs. 3,000',
         'fixed_amount', 50000, 'min_subtotal', 300000, 200),
        ('disc_freeship', ${TENANT}, ${STORE}, 'FREESHIP', 'Free Standard Shipping across Pakistan', 'Free courier delivery on orders above Rs. 2,500',
         'free_shipping', 0, 'min_subtotal', 250000, 1000)
      ON CONFLICT (id) DO NOTHING`;

    await tx`
      INSERT INTO customers (id, tenant_id, store_id, first_name, last_name, phone, email, orders_count, total_spent_minor, tags, notes) VALUES
        ('cust_hamza_01',  ${TENANT}, ${STORE}, 'Hamza',  'Khan',  '+923001234567', 'hamza.khan@gmail.com',   3, 1450000, ARRAY['vip','repeat_buyer','lahore'], 'High-value customer. Prefers Trax Courier delivery.'),
        ('cust_ayesha_02', ${TENANT}, ${STORE}, 'Ayesha', 'Tariq', '+923219876543', 'ayesha.tariq@yahoo.com', 1,  385000, ARRAY['karachi','cod_verified'],        'Verified via WhatsApp before first shipment.'),
        ('cust_bilal_03',  ${TENANT}, ${STORE}, 'Bilal',  'Ahmed', '+923335557799', 'bilal.ahmed@outlook.com',2,  890000, ARRAY['islamabad','frequent_buyer'],   'Reliable customer. Always pays exact cash.')
      ON CONFLICT DO NOTHING`;
  });

  console.log('✅ Demo tenant, store, product, collections, discounts and customers are in place.');
  await sql.end();
}

main().catch((err) => {
  console.error(`❌ Seed failed: ${err.message}`);
  process.exit(1);
});
