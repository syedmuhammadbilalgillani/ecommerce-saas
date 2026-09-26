import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { DRIZZLE } from '../db/db.module';
import { type Database, stores, eq, asc } from '@repo/db';
import { AuthService, type SessionUser } from './auth.service';
import { readSessionToken } from './session-token';

export interface MerchantContext {
  user: SessionUser;
  tenantId: string;
  /** The store every merchant query must be scoped to — always one owned by `tenantId`. */
  storeId: string;
  storeName: string;
}

type AuthedRequest = FastifyRequest & {
  merchant?: MerchantContext;
  platformUser?: SessionUser;
  storefrontStoreId?: string;
};

function headerValue(req: FastifyRequest, name: string): string | undefined {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

/**
 * Requires a merchant session and pins the request to one of that merchant's stores.
 * `x-store-id` may pick among the tenant's own stores; any other store id is rejected.
 */
@Injectable()
export class MerchantGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    @Inject(DRIZZLE) private readonly db: Database
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.auth.requireUser(readSessionToken(req, 'merchant'), 'merchant');
    const tenantId = user.tenantId!;

    const requestedStoreId = headerValue(req, 'x-store-id');
    let store: { id: string; tenantId: string; name: string } | undefined;

    if (requestedStoreId) {
      store = await this.db.query.stores.findFirst({
        where: eq(stores.id, requestedStoreId),
        columns: { id: true, tenantId: true, name: true },
      });
      if (!store || store.tenantId !== tenantId) {
        throw new ForbiddenException('You do not have access to this store');
      }
    } else {
      store = await this.db.query.stores.findFirst({
        where: eq(stores.tenantId, tenantId),
        columns: { id: true, tenantId: true, name: true },
        orderBy: [asc(stores.createdAt)],
      });
      if (!store) {
        throw new ForbiddenException('Your account has no store yet');
      }
    }

    req.merchant = { user, tenantId, storeId: store.id, storeName: store.name };
    return true;
  }
}

@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    req.platformUser = await this.auth.requireUser(readSessionToken(req, 'platform_admin'), 'platform_admin');
    return true;
  }
}

/**
 * Public storefront routes: resolves which store is being shopped (x-store-id, else DEFAULT_STORE_ID)
 * and hides stores whose tenant is suspended.
 */
@Injectable()
export class StorefrontStoreGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const storeId = headerValue(req, 'x-store-id') || process.env.DEFAULT_STORE_ID || 'store_default';

    const store = await this.db.query.stores.findFirst({
      where: eq(stores.id, storeId),
      with: { tenant: true },
    });
    if (!store || store.tenant.status !== 'active') {
      throw new NotFoundException('Store not found');
    }

    req.storefrontStoreId = store.id;
    return true;
  }
}

export const CurrentMerchant = createParamDecorator((_: unknown, ctx: ExecutionContext): MerchantContext => {
  const merchant = ctx.switchToHttp().getRequest<AuthedRequest>().merchant;
  if (!merchant) throw new Error('CurrentMerchant used without MerchantGuard');
  return merchant;
});

export const CurrentPlatformUser = createParamDecorator((_: unknown, ctx: ExecutionContext): SessionUser => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().platformUser;
  if (!user) throw new Error('CurrentPlatformUser used without PlatformGuard');
  return user;
});

export const StorefrontStore = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const storeId = ctx.switchToHttp().getRequest<AuthedRequest>().storefrontStoreId;
  if (!storeId) throw new Error('StorefrontStore used without StorefrontStoreGuard');
  return storeId;
});
