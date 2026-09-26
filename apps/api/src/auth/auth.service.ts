import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { type Database, users, sessions, stores, eq, and, ne, gt, lt, asc, verifyPassword, hashPassword, MIN_PASSWORD_LENGTH } from '@repo/db';
import { hashSecret, newSecret, SESSION_TTL_MS, type Role } from './session-token';

export type PlatformRole = 'super_admin' | 'support' | 'viewer';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  platformRole?: PlatformRole | null;
  tenantId: string | null;
}

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  // Per-email failed login counter. In-memory is enough for a single API instance;
  // move to Redis/DB when running several instances.
  private readonly failedLogins = new Map<string, { count: number; firstAt: number }>();
  // Single-use 60-second exchange tokens for platform-to-merchant impersonation
  private readonly impersonationTokens = new Map<
    string,
    { userId: string; tenantId: string; adminId: string; adminEmail: string; expiresAt: number }
  >();

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async login(rawEmail: string, password: string, role: Role): Promise<{ token: string; user: SessionUser }> {
    const email = (rawEmail || '').trim().toLowerCase();
    if (!email || !password) {
      throw new UnauthorizedException('Email and password are required');
    }
    this.assertNotLockedOut(email);

    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email),
      with: { tenant: true },
    });

    // Same message for every failure so the response does not reveal which emails exist.
    const valid =
      !!user &&
      user.role === role &&
      user.status === 'active' &&
      (role === 'platform_admin' || user.tenant?.status === 'active') &&
      (await verifyPassword(password, user.passwordHash));

    if (!valid || !user) {
      this.recordFailure(email);
      throw new UnauthorizedException('Invalid email or password');
    }
    this.failedLogins.delete(email);

    // Opportunistic cleanup of this user's expired sessions.
    await this.db.delete(sessions).where(and(eq(sessions.userId, user.id), lt(sessions.expiresAt, new Date())));

    const token = newSecret();
    await this.db.insert(sessions).values({
      id: hashSecret(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return { token, user: this.toSessionUser(user) };
  }

  async logout(token: string | null) {
    if (!token) return;
    await this.db.delete(sessions).where(eq(sessions.id, hashSecret(token)));
  }

  /**
   * Changes the signed-in user's password and signs out every other session of that user
   * (the current one stays signed in).
   */
  async changePassword(userId: string, currentToken: string, currentPassword: string, newPassword: string) {
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user || !(await verifyPassword(currentPassword || '', user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current one');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
        .where(eq(users.id, userId));
      await tx.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, hashSecret(currentToken))));
    });
  }

  /** Generates a single-use 60-second token allowing a platform admin to impersonate a merchant user. */
  createImpersonationToken(admin: SessionUser, tenantId: string, userId: string): string {
    const token = `imp_${newSecret(24)}`;
    this.impersonationTokens.set(token, {
      userId,
      tenantId,
      adminId: admin.id,
      adminEmail: admin.email,
      expiresAt: Date.now() + 60_000,
    });
    return token;
  }

  /** Exchanges a valid 60-second impersonation token for a real merchant session and deletes the token. */
  async exchangeImpersonationToken(token: string): Promise<{ sessionToken: string; user: SessionUser; adminEmail: string }> {
    const now = Date.now();
    for (const [k, v] of this.impersonationTokens.entries()) {
      if (now > v.expiresAt) this.impersonationTokens.delete(k);
    }

    const entry = this.impersonationTokens.get(token);
    if (!entry || now > entry.expiresAt) {
      throw new UnauthorizedException('Impersonation token is invalid or expired. Please generate a new link from Platform Admin.');
    }
    this.impersonationTokens.delete(token);

    const user = await this.db.query.users.findFirst({
      where: eq(users.id, entry.userId),
      with: { tenant: true },
    });

    if (!user || user.status !== 'active' || user.role !== 'merchant' || user.tenant?.status !== 'active') {
      throw new UnauthorizedException('Target merchant account or store is not active.');
    }

    const sessionToken = newSecret();
    await this.db.insert(sessions).values({
      id: hashSecret(sessionToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return { sessionToken, user: this.toSessionUser(user), adminEmail: entry.adminEmail };
  }

  /** Resolves a session token to an active user of the given role, or throws 401. */
  async requireUser(token: string | null, role: Role): Promise<SessionUser> {
    if (!token) {
      throw new UnauthorizedException('Not signed in');
    }

    const session = await this.db.query.sessions.findFirst({
      where: and(eq(sessions.id, hashSecret(token)), gt(sessions.expiresAt, new Date())),
      with: { user: { with: { tenant: true } } },
    });
    const user = session?.user;

    if (!user || user.role !== role || user.status !== 'active') {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    if (role === 'merchant' && user.tenant?.status !== 'active') {
      throw new UnauthorizedException('This store account is suspended.');
    }
    return this.toSessionUser(user);
  }

  private toSessionUser(user: { id: string; email: string; name: string | null; role: string; platformRole?: string | null; tenantId: string | null }): SessionUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      platformRole: (user.platformRole as PlatformRole) || (user.role === 'platform_admin' ? 'super_admin' : null),
      tenantId: user.tenantId,
    };
  }

  private assertNotLockedOut(email: string) {
    const entry = this.failedLogins.get(email);
    if (!entry) return;
    if (Date.now() - entry.firstAt > LOCKOUT_WINDOW_MS) {
      this.failedLogins.delete(email);
      return;
    }
    if (entry.count >= MAX_FAILED_LOGINS) {
      throw new HttpException('Too many failed attempts. Try again in 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private recordFailure(email: string) {
    const entry = this.failedLogins.get(email);
    if (!entry || Date.now() - entry.firstAt > LOCKOUT_WINDOW_MS) {
      this.failedLogins.set(email, { count: 1, firstAt: Date.now() });
    } else {
      entry.count += 1;
    }
  }

  async getTenantStores(tenantId: string) {
    return this.db.query.stores.findMany({
      where: eq(stores.tenantId, tenantId),
      columns: { id: true, name: true, slug: true, currency: true },
      orderBy: [asc(stores.createdAt)],
    });
  }
}
