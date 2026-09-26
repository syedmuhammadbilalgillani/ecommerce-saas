import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { randomBytes } from 'node:crypto';
import { type Database, tenants, stores, orders, users, eq, and, ne, gte, sql, hashPassword, MIN_PASSWORD_LENGTH } from '@repo/db';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TENANT_STATUSES = ['active', 'suspended'] as const;

function monthAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

@Injectable()
export class PlatformService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getPlatformAnalytics() {
    const [[tenantCount], [storeCount], [gmv]] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)::int` }).from(tenants),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(stores)
        .innerJoin(tenants, eq(stores.tenantId, tenants.id))
        .where(eq(tenants.status, 'active')),
      this.db
        .select({ total: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::bigint` })
        .from(orders)
        .where(and(ne(orders.orderStatus, 'cancelled'), gte(orders.createdAt, monthAgo()))),
    ]);

    return {
      totalTenants: tenantCount.count,
      activeStores: storeCount.count,
      monthlyGmvMinor: Number(gmv.total),
      // Not tracked yet: there is no billing/subscription table or latency telemetry.
      platformArrMinor: null,
      apiP95LatencyMs: null,
      systemHealth: 'healthy' as const,
    };
  }

  async listTenants() {
    const [tenantRows, gmvRows] = await Promise.all([
      this.db.query.tenants.findMany({
        with: { stores: true },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      }),
      this.db
        .select({
          tenantId: orders.tenantId,
          total: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::bigint`,
        })
        .from(orders)
        .where(and(ne(orders.orderStatus, 'cancelled'), gte(orders.createdAt, monthAgo())))
        .groupBy(orders.tenantId),
    ]);

    const gmvByTenant = new Map(gmvRows.map((r) => [r.tenantId, Number(r.total)]));

    return tenantRows.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.stores[0]?.slug ?? null,
      plan: null, // No subscription plans are stored yet.
      status: t.status,
      createdAt: t.createdAt.toISOString().split('T')[0],
      storesCount: t.stores.length,
      monthlyGmvMinor: gmvByTenant.get(t.id) ?? 0,
    }));
  }

  async createTenant(payload: { name: string; slug: string; ownerEmail: string; ownerPassword: string }) {
    const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
    const slug = typeof payload?.slug === 'string' ? payload.slug.trim().toLowerCase() : '';
    const ownerEmail = typeof payload?.ownerEmail === 'string' ? payload.ownerEmail.trim().toLowerCase() : '';
    const ownerPassword = typeof payload?.ownerPassword === 'string' ? payload.ownerPassword : '';
    if (!name) {
      throw new BadRequestException('name is required');
    }
    if (!SLUG_PATTERN.test(slug)) {
      throw new BadRequestException('slug may only contain lowercase letters, numbers and single hyphens');
    }
    if (!ownerEmail.includes('@')) {
      throw new BadRequestException('A valid owner email is required');
    }
    if (ownerPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Owner password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const existing = await this.db.query.stores.findFirst({ where: eq(stores.slug, slug), columns: { id: true } });
    if (existing) {
      throw new ConflictException(`Store slug '${slug}' is already taken`);
    }
    const existingUser = await this.db.query.users.findFirst({ where: eq(users.email, ownerEmail), columns: { id: true } });
    if (existingUser) {
      throw new ConflictException(`A user with email ${ownerEmail} already exists`);
    }

    const suffix = randomBytes(8).toString('hex');
    const tenantId = `tenant_${suffix}`;
    const storeId = `store_${suffix}`;
    const passwordHash = await hashPassword(ownerPassword);

    await this.db.transaction(async (tx) => {
      await tx.insert(tenants).values({
        id: tenantId,
        name,
        defaultCurrency: 'PKR',
        defaultLocale: 'en',
        status: 'active',
      });
      await tx.insert(stores).values({
        id: storeId,
        tenantId,
        name: `${name} Main Store`,
        slug,
        currency: 'PKR',
      });
      await tx.insert(users).values({
        id: `user_${randomBytes(12).toString('hex')}`,
        email: ownerEmail,
        passwordHash,
        role: 'merchant',
        tenantId,
      });
    });

    const [created] = (await this.listTenants()).filter((t) => t.id === tenantId);
    return created;
  }

  async setTenantStatus(tenantId: string, status: string) {
    if (!TENANT_STATUSES.includes(status as (typeof TENANT_STATUSES)[number])) {
      throw new BadRequestException(`status must be one of: ${TENANT_STATUSES.join(', ')}`);
    }

    const updated = await this.db
      .update(tenants)
      .set({ status, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning({ id: tenants.id });
    if (updated.length === 0) {
      throw new NotFoundException(`Tenant '${tenantId}' not found`);
    }

    const [tenant] = (await this.listTenants()).filter((t) => t.id === tenantId);
    return tenant;
  }
}
