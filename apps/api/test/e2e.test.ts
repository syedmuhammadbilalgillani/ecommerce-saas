/**
 * End-to-end tests: boots the compiled API on a spare port and exercises it over HTTP against a
 * real Postgres database — auth, tenant isolation, race-safe checkout, admin features.
 *
 *   E2E_ALLOW_WRITES=true pnpm --filter api test:e2e
 *
 * It WRITES to the database in DATABASE_URL (a Neon branch or a dedicated test database is best).
 * Everything it creates is tagged with a run id and deleted afterwards. It needs the demo store
 * (`pnpm db:seed`) because orders are placed against store_default.
 */
import 'dotenv/config';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import postgres from 'postgres';
import { hashPassword } from '@repo/db';

const ALLOWED = process.env.E2E_ALLOW_WRITES === 'true';
const PORT = 4600 + Math.floor(Math.random() * 300);
const API = `http://127.0.0.1:${PORT}`;
const RUN = randomBytes(4).toString('hex');
const STORE = 'store_default';
const TENANT = 'ten_pilot_01';

let server: ChildProcess | undefined;
let sql: ReturnType<typeof postgres>;
const createdCarts: string[] = [];

// ---------------------------------------------------------------- tiny HTTP client with cookies
class Client {
  private cookie = '';
  async call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const json = (await res.json().catch(() => null)) as any;
    return { status: res.status, json };
  }
  get = (p: string, h?: Record<string, string>) => this.call('GET', p, undefined, h);
  post = (p: string, b?: unknown, h?: Record<string, string>) => this.call('POST', p, b ?? {}, h);
  patch = (p: string, b: unknown) => this.call('PATCH', p, b);
}
const anon = new Client();

async function createUser(role: 'merchant' | 'platform_admin', email: string, password: string, tenantId?: string) {
  await sql`
    INSERT INTO users (id, email, password_hash, role, tenant_id)
    VALUES (${'user_e2e_' + randomBytes(8).toString('hex')}, ${email}, ${await hashPassword(password)}, ${role}, ${tenantId ?? null})`;
}

async function login(role: 'merchant' | 'platform', email: string, password: string) {
  const client = new Client();
  const res = await client.post(`/v1/auth/${role}/login`, { email, password });
  assert.equal(res.status, 200, `login ${email}: ${JSON.stringify(res.json)}`);
  return client;
}

async function newCart(variantId: string, quantity: number): Promise<string> {
  const cart = await anon.get('/v1/storefront/cart');
  const cartId = cart.json.data.id as string;
  createdCarts.push(cartId);
  const add = await anon.post('/v1/storefront/cart/items', { variantId, quantity }, { 'x-cart-id': cartId });
  assert.equal(add.status, 201, JSON.stringify(add.json));
  return cartId;
}

const PHONE = `0302${String(parseInt(RUN, 16) % 10_000_000).padStart(7, '0')}`;
function checkout(cartId: string, extra: Record<string, unknown> = {}) {
  return anon.post(
    '/v1/storefront/orders/checkout',
    { customerName: `E2E ${RUN}`, customerPhone: PHONE, shippingAddressLine1: 'Test street', shippingCity: 'Lahore', ...extra },
    { 'x-cart-id': cartId }
  );
}

const count = (results: Array<{ status: number }>, status: number) => results.filter((r) => r.status === status).length;

// ---------------------------------------------------------------- lifecycle
describe('POSflow API end-to-end', { skip: !ALLOWED && 'set E2E_ALLOW_WRITES=true to run (writes to DATABASE_URL)' }, () => {
  let merchant: Client;
  let platform: Client;
  let productOne: { id: string; variantId: string; slug: string };
  let productMany: { id: string; variantId: string; slug: string };
  const merchantEmail = `e2e-merchant-${RUN}@posflow.test`;
  const merchantPassword = randomBytes(12).toString('hex');

  before(async () => {
    const url = process.env.DATABASE_URL;
    assert.ok(url, 'DATABASE_URL is required');
    sql = postgres(url, { ssl: url.includes('neon.tech') || url.includes('sslmode=require') ? 'require' : false, max: 2, onnotice: () => {} });

    const [store] = await sql`SELECT id FROM stores WHERE id = ${STORE}`;
    assert.ok(store, 'demo store missing — run pnpm db:seed first');

    server = spawn(process.execPath, [join(import.meta.dirname, '..', 'dist', 'main.js')], {
      env: { ...process.env, PORT: String(PORT), RATE_LIMIT_DISABLED: 'true', LOG_LEVEL: 'warn', NODE_ENV: 'test' },
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`${API}/health`)).ok) break;
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    await createUser('merchant', merchantEmail, merchantPassword, TENANT);
    const adminPassword = randomBytes(12).toString('hex');
    await createUser('platform_admin', `e2e-admin-${RUN}@posflow.test`, adminPassword);
    merchant = await login('merchant', merchantEmail, merchantPassword);
    platform = await login('platform', `e2e-admin-${RUN}@posflow.test`, adminPassword);

    const make = async (name: string, stock: number) => {
      const slug = `e2e-${RUN}-${name}`;
      const res = await merchant.post('/v1/merchant/products', {
        title: `E2E ${name} ${RUN}`,
        slug,
        variants: [{ title: 'Only', sku: `E2E-${RUN}-${name}`, priceMinor: 100000, stock }],
      });
      assert.equal(res.status, 201, JSON.stringify(res.json));
      return { id: res.json.data.id, variantId: res.json.data.variants[0].id, slug };
    };
    productOne = await make('one', 1);
    productMany = await make('many', 50);
  });

  after(async () => {
    try {
      if (sql) {
        await sql.begin(async (tx) => {
          await tx`DELETE FROM orders WHERE store_id = ${STORE} AND customer_name = ${`E2E ${RUN}`}`;
          await tx`DELETE FROM customers WHERE store_id = ${STORE} AND first_name = 'E2E' AND last_name = ${RUN}`;
          await tx`DELETE FROM products WHERE store_id = ${STORE} AND slug LIKE ${`e2e-${RUN}-%`}`;
          await tx`DELETE FROM discounts WHERE store_id = ${STORE} AND code LIKE ${`E2E${RUN.toUpperCase()}%`}`;
          if (createdCarts.length) await tx`DELETE FROM carts WHERE id IN ${tx(createdCarts)}`;
          await tx`DELETE FROM tenants WHERE name = ${`E2E Tenant ${RUN}`}`;
          await tx`DELETE FROM users WHERE email LIKE ${`e2e-%-${RUN}@posflow.test`}`;
          // Test orders consumed order numbers; give them back so real numbering has no gap.
          await tx`
            UPDATE stores SET next_order_number = (
              SELECT COALESCE(MAX(substring(order_number FROM '[0-9]+$')::int), 1000) + 1 FROM orders WHERE store_id = ${STORE}
            ) WHERE id = ${STORE}`;
        });
        await sql.end();
      }
    } finally {
      server?.kill();
    }
  });

  // ---------------------------------------------------------------- auth & tenancy
  test('admin APIs require a session', async () => {
    assert.equal((await anon.get('/v1/merchant/orders')).status, 401);
    assert.equal((await anon.get('/v1/platform/tenants')).status, 401);
    assert.equal((await merchant.get('/v1/platform/tenants')).status, 401);
  });

  test('a second tenant cannot see or touch the first tenant’s data', async () => {
    const ownerEmail = `e2e-owner-${RUN}@posflow.test`;
    const ownerPassword = randomBytes(12).toString('hex');
    const created = await platform.post('/v1/platform/tenants', {
      name: `E2E Tenant ${RUN}`,
      slug: `e2e-${RUN}`,
      ownerEmail,
      ownerPassword,
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const other = await login('merchant', ownerEmail, ownerPassword);

    assert.equal((await other.get('/v1/merchant/customers')).json.data.length, 0);
    assert.equal((await other.get('/v1/merchant/products')).json.data.length, 0);
    assert.equal((await other.call('GET', '/v1/merchant/orders', undefined, { 'x-store-id': STORE })).status, 403);
    assert.equal((await other.patch(`/v1/merchant/products/${productMany.id}`, { title: 'hijack' })).status, 404);
  });

  // ---------------------------------------------------------------- checkout integrity
  test('8 buyers racing for the last unit: exactly one order, stock never negative', async () => {
    const carts = await Promise.all(Array.from({ length: 8 }, () => newCart(productOne.variantId, 1)));
    const results = await Promise.all(carts.map((c) => checkout(c)));
    assert.equal(count(results, 201), 1);
    assert.equal(count(results, 409), 7);
    assert.ok(results.find((r) => r.status === 409)!.json.outOfStock?.length, '409 lists the short line');
    const product = await anon.get(`/v1/storefront/products/${productOne.slug}`);
    assert.equal(product.json.data.variants[0].stock, 0);
  });

  test('a usage-limit-1 coupon is redeemed exactly once under concurrency', async () => {
    const code = `E2E${RUN.toUpperCase()}ONCE`;
    const created = await merchant.post('/v1/merchant/discounts', {
      code,
      title: 'E2E once',
      discountType: 'percentage',
      value: 10,
      usageLimit: 1,
    });
    assert.equal(created.status, 201, JSON.stringify(created.json));

    const carts = await Promise.all(Array.from({ length: 6 }, () => newCart(productMany.variantId, 1)));
    const results = await Promise.all(carts.map((c) => checkout(c, { discountCode: code })));
    assert.equal(count(results, 201), 1);
    const discounts = await merchant.get('/v1/merchant/discounts');
    assert.equal(discounts.json.data.find((d: any) => d.code === code).timesUsed, 1);
  });

  test('concurrent orders get unique numbers and one customer with exact counts', async () => {
    const carts = await Promise.all(Array.from({ length: 5 }, () => newCart(productMany.variantId, 1)));
    const results = await Promise.all(carts.map((c) => checkout(c)));
    assert.equal(count(results, 201), 5);

    const [row] = await sql`
      SELECT count(*)::int AS orders, count(DISTINCT order_number)::int AS numbers
      FROM orders WHERE store_id = ${STORE} AND customer_name = ${`E2E ${RUN}`}`;
    assert.equal(row.numbers, row.orders, 'order numbers are unique');

    const [cust] = await sql`
      SELECT count(*)::int AS rows, max(orders_count)::int AS orders_count FROM customers
      WHERE store_id = ${STORE} AND phone = ${'+92' + PHONE.slice(1)}`;
    assert.equal(cust.rows, 1, 'one customer row per phone');
    assert.equal(cust.orders_count, row.orders, 'customer ordersCount matches committed orders');
  });

  test('double-submitting one cart creates one order', async () => {
    const cartId = await newCart(productMany.variantId, 1);
    const results = await Promise.all([checkout(cartId), checkout(cartId)]);
    assert.equal(count(results, 201), 1);
  });

  test('storefront order pages need the order token', async () => {
    const res = await checkout(await newCart(productMany.variantId, 1));
    assert.equal(res.status, 201);
    const { id, accessToken } = res.json.data;
    assert.equal((await anon.get(`/v1/storefront/orders/${id}`)).status, 404);
    assert.equal((await anon.get(`/v1/storefront/orders/${id}`, { 'x-order-token': 'wrong' })).status, 404);
    assert.equal((await anon.get(`/v1/storefront/orders/${id}`, { 'x-order-token': accessToken })).status, 200);
  });

  test('parallel cancels restock once; re-opening without stock is refused', async () => {
    const [sold] = await sql`
      SELECT o.id FROM orders o JOIN order_items i ON i.order_id = o.id
      WHERE o.store_id = ${STORE} AND i.variant_id = ${productOne.variantId} LIMIT 1`;
    const cancel = () => merchant.patch(`/v1/merchant/orders/${sold.id}/status`, { orderStatus: 'cancelled', fulfillmentStatus: 'cancelled' });
    await Promise.all([cancel(), cancel(), cancel()]);
    assert.equal((await anon.get(`/v1/storefront/products/${productOne.slug}`)).json.data.variants[0].stock, 1);

    assert.equal((await checkout(await newCart(productOne.variantId, 1))).status, 201);
    const reopen = await merchant.patch(`/v1/merchant/orders/${sold.id}/status`, { orderStatus: 'open', fulfillmentStatus: 'unfulfilled' });
    assert.equal(reopen.status, 409);
  });

  test('status endpoint ignores anything but whitelisted status fields', async () => {
    const [order] = await sql`SELECT id FROM orders WHERE store_id = ${STORE} AND customer_name = ${`E2E ${RUN}`} LIMIT 1`;
    assert.equal((await merchant.patch(`/v1/merchant/orders/${order.id}/status`, { totalMinor: 1 })).status, 400);
  });

  // ---------------------------------------------------------------- admin features & pagination
  test('orders list pages with a cursor and reports tab counts', async () => {
    const first = await merchant.get('/v1/merchant/orders?limit=2');
    assert.equal(first.status, 200);
    assert.equal(first.json.data.length, 2);
    assert.ok(first.json.nextCursor);
    assert.ok(first.json.counts.all >= 8);
    const second = await merchant.get(`/v1/merchant/orders?limit=2&cursor=${first.json.nextCursor}`);
    const firstIds = new Set(first.json.data.map((o: any) => o.id));
    assert.ok(second.json.data.every((o: any) => !firstIds.has(o.id)), 'no overlap between pages');
    const searched = await merchant.get(`/v1/merchant/orders?q=${encodeURIComponent(`E2E ${RUN}`)}`);
    assert.ok(searched.json.data.every((o: any) => o.customerName === `E2E ${RUN}`));
  });

  test('analytics and customer list are computed by the database', async () => {
    const analytics = await merchant.get('/v1/merchant/analytics');
    assert.equal(analytics.status, 200, JSON.stringify(analytics.json));
    const [row] = await sql`
      SELECT count(*)::int AS n, coalesce(sum(total_minor), 0)::bigint AS total
      FROM orders WHERE store_id = ${STORE} AND order_status <> 'cancelled'`;
    assert.equal(analytics.json.data.totalOrders, row.n);
    assert.equal(analytics.json.data.grossSalesMinor, Number(row.total));
    assert.ok(Array.isArray(analytics.json.data.salesOverTime) && analytics.json.data.salesOverTime.length > 0);

    const customers = await merchant.get(`/v1/merchant/customers?q=${PHONE}`);
    assert.equal(customers.status, 200);
    assert.equal(customers.json.data.length, 1, 'phone search matches the normalized number');
    assert.ok(customers.json.stats.total >= 1);
  });

  test('stock adjustments are atomic and cannot go negative', async () => {
    const path = `/v1/merchant/products/${productMany.id}/variants/${productMany.variantId}/stock-adjustments`;
    const before = (await merchant.get('/v1/merchant/products')).json.data.find((p: any) => p.id === productMany.id).variants[0].stock;
    assert.equal((await merchant.post(path, { delta: 5 })).json.data.variants[0].stock, before + 5);
    assert.equal((await merchant.post(path, { delta: -99999 })).status, 409);
    assert.equal((await merchant.post(path, { delta: 0 })).status, 400);
  });

  test('store WhatsApp number is validated and normalized', async () => {
    const original = (await merchant.get('/v1/merchant/store')).json.data.whatsappPhone;
    try {
      assert.equal((await merchant.patch('/v1/merchant/store', { whatsappPhone: '12' })).status, 400);
      const ok = await merchant.patch('/v1/merchant/store', { whatsappPhone: '0300-1234567' });
      assert.equal(ok.json.data.whatsappPhone, '+923001234567');
    } finally {
      await merchant.patch('/v1/merchant/store', { whatsappPhone: original });
    }
  });

  test('changing password signs out other sessions only', async () => {
    const otherDevice = await login('merchant', merchantEmail, merchantPassword);
    const newPassword = randomBytes(12).toString('hex');
    const res = await merchant.post('/v1/auth/merchant/password', { currentPassword: merchantPassword, newPassword });
    assert.equal(res.status, 200);
    assert.equal((await merchant.get('/v1/auth/merchant/me')).status, 200);
    assert.equal((await otherDevice.get('/v1/auth/merchant/me')).status, 401);
  });
});
