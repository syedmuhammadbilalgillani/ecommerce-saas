import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { randomBytes } from 'node:crypto';
import { type Database, tenants, stores, orders, users, sessions, eq, and, ne, gte, asc, desc, sql, hashPassword, MIN_PASSWORD_LENGTH } from '@repo/db';
import { AuthService, type SessionUser, type PlatformRole } from '../auth/auth.service';
import { AuditLogService } from './audit-log.service';
import { TelemetryService } from '../common/telemetry.service';
import { CloudinaryService } from '../uploads/cloudinary.service';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TENANT_STATUSES = ['active', 'suspended'] as const;
const USER_STATUSES = ['active', 'disabled'] as const;
const PLATFORM_ROLES = ['super_admin', 'support', 'viewer'] as const;

export const PLAN_PRICING: Record<string, { name: string; priceMinor: number }> = {
  starter: { name: 'Starter', priceMinor: 500_000 },      // PKR 5,000 / month
  growth: { name: 'Growth', priceMinor: 1_500_000 },      // PKR 15,000 / month
  enterprise: { name: 'Enterprise', priceMinor: 5_000_000 }, // PKR 50,000 / month
};

function monthAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

@Injectable()
export class PlatformService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
    private readonly telemetryService: TelemetryService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getPlatformAnalytics() {
    const [[tenantCount], [storeCount], [gmv], [arrRow]] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)::int` }).from(tenants).where(eq(tenants.status, 'active')),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(stores)
        .innerJoin(tenants, eq(stores.tenantId, tenants.id))
        .where(eq(tenants.status, 'active')),
      this.db
        .select({ total: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::bigint` })
        .from(orders)
        .where(and(ne(orders.orderStatus, 'cancelled'), gte(orders.createdAt, monthAgo()))),
      this.db
        .select({
          arr: sql<number>`coalesce(sum(
            case
              when ${tenants.planInterval} = 'year' then ${tenants.planPriceMinor}
              else ${tenants.planPriceMinor} * 12
            end
          ), 0)::bigint`,
        })
        .from(tenants)
        .where(eq(tenants.status, 'active')),
    ]);

    const p95 = this.telemetryService.getP95Latency();

    return {
      totalTenants: tenantCount.count,
      activeStores: storeCount.count,
      monthlyGmvMinor: Number(gmv.total),
      platformArrMinor: Number(arrRow.arr),
      apiP95LatencyMs: p95,
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
      plan: t.plan || 'starter',
      planPriceMinor: t.planPriceMinor ?? 500000,
      planInterval: t.planInterval || 'month',
      status: t.status,
      createdAt: t.createdAt.toISOString().split('T')[0],
      storesCount: t.stores.length,
      monthlyGmvMinor: gmvByTenant.get(t.id) ?? 0,
    }));
  }

  async createTenant(
    payload: { name: string; slug: string; ownerEmail: string; ownerPassword: string; plan?: string },
    actor?: SessionUser
  ) {
    const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
    const slug = typeof payload?.slug === 'string' ? payload.slug.trim().toLowerCase() : '';
    const ownerEmail = typeof payload?.ownerEmail === 'string' ? payload.ownerEmail.trim().toLowerCase() : '';
    const ownerPassword = typeof payload?.ownerPassword === 'string' ? payload.ownerPassword : '';
    const plan = payload?.plan && PLAN_PRICING[payload.plan] ? payload.plan : 'starter';
    const planPriceMinor = PLAN_PRICING[plan].priceMinor;

    if (!name) throw new BadRequestException('name is required');
    if (!SLUG_PATTERN.test(slug)) {
      throw new BadRequestException('slug may only contain lowercase letters, numbers and single hyphens');
    }
    if (!ownerEmail.includes('@')) throw new BadRequestException('A valid owner email is required');
    if (ownerPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Owner password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const existing = await this.db.query.stores.findFirst({ where: eq(stores.slug, slug), columns: { id: true } });
    if (existing) throw new ConflictException(`Store slug '${slug}' is already taken`);

    const existingUser = await this.db.query.users.findFirst({ where: eq(users.email, ownerEmail), columns: { id: true } });
    if (existingUser) throw new ConflictException(`A user with email ${ownerEmail} already exists`);

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
        plan,
        planPriceMinor,
        planInterval: 'month',
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

    if (actor) {
      await this.auditLogService.log({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'tenant.created',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: { name, slug, ownerEmail, plan },
      });
    }

    const [created] = (await this.listTenants()).filter((t) => t.id === tenantId);
    return created;
  }

  /** Full detail for the tenant edit page: tenant + its stores + monthly GMV + plan. */
  async getTenant(tenantId: string) {
    const tenant = await this.db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      with: { stores: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant '${tenantId}' not found`);

    const [gmv] = await this.db
      .select({ total: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::bigint` })
      .from(orders)
      .where(and(ne(orders.orderStatus, 'cancelled'), gte(orders.createdAt, monthAgo())));

    const store = tenant.stores[0] ?? null;
    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      plan: tenant.plan || 'starter',
      planPriceMinor: tenant.planPriceMinor ?? 500000,
      planInterval: tenant.planInterval || 'month',
      createdAt: tenant.createdAt.toISOString().split('T')[0],
      storeId: store?.id ?? null,
      storeName: store?.name ?? null,
      slug: store?.slug ?? null,
      whatsappPhone: store?.whatsappPhone ?? null,
      monthlyGmvMinor: Number(gmv.total),
      stores: tenant.stores.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        currency: s.currency,
        whatsappPhone: s.whatsappPhone,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }

  /** Adds another store/outlet to an existing tenant. */
  async addTenantStore(
    tenantId: string,
    payload: { name: string; slug: string; whatsappPhone?: string },
    actor?: SessionUser
  ) {
    const tenant = await this.db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    if (!tenant) throw new NotFoundException(`Tenant '${tenantId}' not found`);

    const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
    const slug = typeof payload?.slug === 'string' ? payload.slug.trim().toLowerCase() : '';
    const whatsappPhone = typeof payload?.whatsappPhone === 'string' && payload.whatsappPhone.trim() ? payload.whatsappPhone.trim() : null;

    if (!name) throw new BadRequestException('Store name cannot be empty');
    if (!SLUG_PATTERN.test(slug)) {
      throw new BadRequestException('Store slug may only contain lowercase letters, numbers, and single hyphens');
    }

    const taken = await this.db.query.stores.findFirst({ where: eq(stores.slug, slug), columns: { id: true } });
    if (taken) throw new ConflictException(`Store slug '${slug}' is already taken`);

    const storeId = `store_${randomBytes(8).toString('hex')}`;
    await this.db.insert(stores).values({
      id: storeId,
      tenantId,
      name,
      slug,
      currency: tenant.defaultCurrency || 'PKR',
      defaultLocale: tenant.defaultLocale || 'en',
      whatsappPhone,
    });

    if (actor) {
      await this.auditLogService.log({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'store.created',
        targetType: 'store',
        targetId: storeId,
        metadata: { tenantId, name, slug },
      });
    }

    return this.getTenant(tenantId);
  }

  /** Renames tenant, modifies plan, or renames store. */
  async updateTenant(
    tenantId: string,
    payload: {
      name?: string;
      storeName?: string;
      slug?: string;
      plan?: string;
      planPriceMinor?: number;
      planInterval?: string;
    },
    actor?: SessionUser
  ) {
    const tenant = await this.db.query.tenants.findFirst({ where: eq(tenants.id, tenantId), with: { stores: true } });
    if (!tenant) throw new NotFoundException(`Tenant '${tenantId}' not found`);
    const store = tenant.stores[0];

    // Check role restriction: updating plan requires super_admin
    if (payload?.plan !== undefined || payload?.planPriceMinor !== undefined || payload?.planInterval !== undefined) {
      if (actor && actor.platformRole && actor.platformRole !== 'super_admin') {
        throw new ForbiddenException('Modifying subscription plans requires super_admin role');
      }
    }

    await this.db.transaction(async (tx) => {
      const tenantUpdates: Record<string, unknown> = { updatedAt: new Date() };

      if (payload?.name !== undefined) {
        const name = payload.name.trim();
        if (!name) throw new BadRequestException('name cannot be empty');
        tenantUpdates.name = name;
      }

      if (payload?.plan !== undefined) {
        const plan = payload.plan.trim().toLowerCase();
        if (!PLAN_PRICING[plan]) {
          throw new BadRequestException(`plan must be one of: ${Object.keys(PLAN_PRICING).join(', ')}`);
        }
        tenantUpdates.plan = plan;
        if (payload?.planPriceMinor === undefined) {
          tenantUpdates.planPriceMinor = PLAN_PRICING[plan].priceMinor;
        }
      }

      if (payload?.planPriceMinor !== undefined) {
        if (typeof payload.planPriceMinor !== 'number' || payload.planPriceMinor < 0) {
          throw new BadRequestException('planPriceMinor must be a non-negative number');
        }
        tenantUpdates.planPriceMinor = Math.round(payload.planPriceMinor);
      }

      if (payload?.planInterval !== undefined) {
        if (!['month', 'year'].includes(payload.planInterval)) {
          throw new BadRequestException('planInterval must be "month" or "year"');
        }
        tenantUpdates.planInterval = payload.planInterval;
      }

      if (Object.keys(tenantUpdates).length > 1) {
        await tx.update(tenants).set(tenantUpdates).where(eq(tenants.id, tenantId));
      }

      if (!store && (payload?.storeName !== undefined || payload?.slug !== undefined)) {
        throw new BadRequestException('This tenant has no store yet');
      }

      if (store && payload?.storeName !== undefined) {
        const storeName = payload.storeName.trim();
        if (!storeName) throw new BadRequestException('storeName cannot be empty');
        await tx.update(stores).set({ name: storeName, updatedAt: new Date() }).where(eq(stores.id, store.id));
      }

      if (store && payload?.slug !== undefined) {
        const slug = payload.slug.trim().toLowerCase();
        if (!SLUG_PATTERN.test(slug)) {
          throw new BadRequestException('slug may only contain lowercase letters, numbers and single hyphens');
        }
        if (slug !== store.slug) {
          const taken = await tx.query.stores.findFirst({ where: eq(stores.slug, slug), columns: { id: true } });
          if (taken) throw new ConflictException(`Store slug '${slug}' is already taken`);
          await tx.update(stores).set({ slug, updatedAt: new Date() }).where(eq(stores.id, store.id));
        }
      }
    });

    if (actor) {
      await this.auditLogService.log({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'tenant.updated',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: payload,
      });
    }

    return this.getTenant(tenantId);
  }

  async setTenantStatus(tenantId: string, status: string, actor?: SessionUser) {
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

    if (actor) {
      await this.auditLogService.log({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: status === 'suspended' ? 'tenant.suspended' : 'tenant.activated',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: { status },
      });
    }

    const [tenant] = (await this.listTenants()).filter((t) => t.id === tenantId);
    return tenant;
  }

  async getTenantCloudinary(tenantId: string) {
    return this.cloudinaryService.getPublicConfig(tenantId);
  }

  async setTenantCloudinary(tenantId: string, body: { cloudName?: unknown; apiKey?: unknown; apiSecret?: unknown }, actor: SessionUser) {
    const config = await this.cloudinaryService.save(tenantId, body ?? {});
    await this.auditLogService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'tenant.cloudinary_configured',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { cloudName: config.configured ? config.cloudName : null },
    });
    return config;
  }

  async removeTenantCloudinary(tenantId: string, actor: SessionUser) {
    await this.cloudinaryService.remove(tenantId);
    await this.auditLogService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'tenant.cloudinary_removed',
      targetType: 'tenant',
      targetId: tenantId,
    });
  }

  async listTenantUsers(tenantId: string) {
    const tenant = await this.db.query.tenants.findFirst({ where: eq(tenants.id, tenantId), columns: { id: true } });
    if (!tenant) throw new NotFoundException(`Tenant '${tenantId}' not found`);
    return this.db.query.users.findMany({
      where: eq(users.tenantId, tenantId),
      columns: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
      orderBy: (u, { asc }) => [asc(u.createdAt)],
    });
  }

  /** Adds another merchant login (staff) to an existing tenant. */
  async createTenantUser(
    tenantId: string,
    payload: { email: string; password: string; name?: string },
    actor?: SessionUser
  ) {
    const tenant = await this.db.query.tenants.findFirst({ where: eq(tenants.id, tenantId), columns: { id: true } });
    if (!tenant) throw new NotFoundException(`Tenant '${tenantId}' not found`);

    const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const password = typeof payload?.password === 'string' ? payload.password : '';
    const name = typeof payload?.name === 'string' && payload.name.trim() ? payload.name.trim() : null;
    if (!email.includes('@')) throw new BadRequestException('A valid email is required');
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const existing = await this.db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
    if (existing) throw new ConflictException(`A user with email ${email} already exists`);

    const id = `user_${randomBytes(12).toString('hex')}`;
    await this.db.insert(users).values({
      id,
      email,
      name,
      passwordHash: await hashPassword(password),
      role: 'merchant',
      tenantId,
    });

    if (actor) {
      await this.auditLogService.log({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'staff.created',
        targetType: 'user',
        targetId: id,
        metadata: { tenantId, email },
      });
    }

    return this.listTenantUsers(tenantId);
  }

  /** Enables or disables a tenant's user (never a platform admin); disabling signs them out everywhere. */
  async setTenantUserStatus(tenantId: string, userId: string, status: string, actor?: SessionUser) {
    if (!USER_STATUSES.includes(status as (typeof USER_STATUSES)[number])) {
      throw new BadRequestException(`status must be one of: ${USER_STATUSES.join(', ')}`);
    }
    const user = await this.db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.tenantId, tenantId)),
      columns: { id: true },
    });
    if (!user) throw new NotFoundException('User not found in this tenant');

    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
      if (status === 'disabled') {
        await tx.delete(sessions).where(eq(sessions.userId, userId));
      }
    });

    if (actor) {
      await this.auditLogService.log({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'staff.status_changed',
        targetType: 'user',
        targetId: userId,
        metadata: { tenantId, status },
      });
    }

    return this.listTenantUsers(tenantId);
  }

  /** Sets a new password for a merchant user and signs them out everywhere. */
  async resetMerchantPassword(userId: string, newPassword: string, actor?: SessionUser) {
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, role: true, tenantId: true } });
    if (!user || user.role !== 'merchant') throw new NotFoundException('Merchant user not found');

    const passwordHash = await hashPassword(newPassword);
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
    });

    if (actor) {
      await this.auditLogService.log({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'staff.password_reset',
        targetType: 'user',
        targetId: userId,
        metadata: { tenantId: user.tenantId },
      });
    }
  }

  /** Generates a 1-click single-use exchange token allowing the platform admin to log into the merchant portal. */
  async impersonateTenant(tenantId: string, admin: SessionUser, targetUserId?: string) {
    const tenant = await this.db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
    if (!tenant) throw new NotFoundException(`Tenant '${tenantId}' not found`);
    if (tenant.status === 'suspended') {
      throw new BadRequestException('Cannot impersonate a suspended tenant. Activate the tenant first.');
    }

    let targetUser;
    if (targetUserId) {
      targetUser = await this.db.query.users.findFirst({
        where: and(eq(users.id, targetUserId), eq(users.tenantId, tenantId), eq(users.role, 'merchant')),
      });
      if (!targetUser) throw new NotFoundException('Merchant user not found in this tenant');
      if (targetUser.status !== 'active') throw new BadRequestException('Cannot impersonate a disabled user');
    } else {
      targetUser = await this.db.query.users.findFirst({
        where: and(eq(users.tenantId, tenantId), eq(users.role, 'merchant'), eq(users.status, 'active')),
        orderBy: (u, { asc }) => [asc(u.createdAt)],
      });
      if (!targetUser) throw new NotFoundException('No active merchant user found for this tenant');
    }

    const token = this.authService.createImpersonationToken(admin, tenantId, targetUser.id);
    const merchantAdminUrl =
      process.env.NEXT_PUBLIC_MERCHANT_ADMIN_URL || process.env.MERCHANT_ADMIN_URL || 'http://localhost:3001';

    await this.auditLogService.log({
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'tenant.impersonated',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { targetUserId: targetUser.id, targetUserEmail: targetUser.email },
    });

    return {
      token,
      targetUser: { id: targetUser.id, email: targetUser.email, name: targetUser.name },
      redirectUrl: `${merchantAdminUrl}/impersonate?token=${token}`,
    };
  }

  /** Lists all platform admins and their roles. */
  async listAdmins() {
    const adminUsers = await this.db.query.users.findMany({
      where: eq(users.role, 'platform_admin'),
      columns: { id: true, email: true, name: true, role: true, platformRole: true, status: true, createdAt: true },
      orderBy: (u, { asc }) => [asc(u.createdAt)],
    });
    return adminUsers.map((u) => ({
      ...u,
      platformRole: (u.platformRole as PlatformRole) || 'super_admin',
    }));
  }

  /** Provisions a new platform admin account from the UI. */
  async createAdmin(
    payload: { email: string; password: string; name?: string; platformRole?: string },
    actor?: SessionUser
  ) {
    const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const password = typeof payload?.password === 'string' ? payload.password : '';
    const name = typeof payload?.name === 'string' && payload.name.trim() ? payload.name.trim() : null;
    const platformRole = payload?.platformRole || 'super_admin';

    if (!email.includes('@')) throw new BadRequestException('A valid email is required');
    if (!PLATFORM_ROLES.includes(platformRole as any)) {
      throw new BadRequestException(`platformRole must be one of: ${PLATFORM_ROLES.join(', ')}`);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const existing = await this.db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
    if (existing) throw new ConflictException(`A user with email '${email}' already exists`);

    const id = `user_${randomBytes(12).toString('hex')}`;
    await this.db.insert(users).values({
      id,
      email,
      name,
      passwordHash: await hashPassword(password),
      role: 'platform_admin',
      platformRole,
      tenantId: null,
      status: 'active',
    });

    if (actor) {
      await this.auditLogService.log({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'admin.created',
        targetType: 'admin',
        targetId: id,
        metadata: { email, platformRole },
      });
    }

    return this.listAdmins();
  }

  /** Enables or disables a platform admin account (disabling instantly revokes all active sessions). */
  async setAdminStatus(adminId: string, currentAdminId: string, status: string, actor?: SessionUser) {
    if (!USER_STATUSES.includes(status as (typeof USER_STATUSES)[number])) {
      throw new BadRequestException(`status must be one of: ${USER_STATUSES.join(', ')}`);
    }
    if (adminId === currentAdminId && status === 'disabled') {
      throw new BadRequestException('You cannot disable your own platform admin account');
    }

    const admin = await this.db.query.users.findFirst({
      where: and(eq(users.id, adminId), eq(users.role, 'platform_admin')),
      columns: { id: true },
    });
    if (!admin) throw new NotFoundException('Platform admin not found');

    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, adminId));
      if (status === 'disabled') {
        await tx.delete(sessions).where(eq(sessions.userId, adminId));
      }
    });

    if (actor) {
      await this.auditLogService.log({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'admin.status_changed',
        targetType: 'admin',
        targetId: adminId,
        metadata: { status },
      });
    }

    return this.listAdmins();
  }

  /** Resets another platform admin's password and revokes all their active sessions. */
  async resetAdminPassword(adminId: string, newPassword: string, actor?: SessionUser) {
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    const admin = await this.db.query.users.findFirst({
      where: and(eq(users.id, adminId), eq(users.role, 'platform_admin')),
      columns: { id: true },
    });
    if (!admin) throw new NotFoundException('Platform admin not found');

    const passwordHash = await hashPassword(newPassword);
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, adminId));
      await tx.delete(sessions).where(eq(sessions.userId, adminId));
    });

    if (actor) {
      await this.auditLogService.log({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'admin.password_reset',
        targetType: 'admin',
        targetId: adminId,
      });
    }
  }

  /** Fetches immutable activity audit logs. */
  async getAuditLogs(options?: { limit?: number; action?: string; targetType?: string }) {
    return this.auditLogService.list(options);
  }
}
