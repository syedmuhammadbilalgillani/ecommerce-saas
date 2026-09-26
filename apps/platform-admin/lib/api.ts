// Browser calls go through this app's own /api rewrite (see next.config.mjs) so session
// cookies are first-party. Server components call the API directly and forward cookies.
const API_URL =
  typeof window === 'undefined' ? process.env.API_URL || 'http://127.0.0.1:4000' : '/api';

export { formatPrice } from './utils';

/** Thrown when the API says the admin is not signed in (or the session expired). */
export class AuthError extends Error {}

/**
 * Calls the API and unwraps `data`; throws with the API's own message on failure.
 * Server components must forward the incoming cookie header via `init.headers`.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      cache: 'no-store',
      credentials: 'include',
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error('Cannot reach the API server. Check that it is running.');
  }

  const json = await res.json().catch(() => null);
  if (res.status === 401) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new AuthError(json?.message || 'Please sign in');
  }
  if (!res.ok) {
    const message = Array.isArray(json?.message) ? json.message.join(', ') : json?.message;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return (json?.data ?? json) as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

export interface PlatformTenant {
  id: string;
  name: string;
  slug: string | null;
  plan: 'starter' | 'growth' | 'enterprise' | string | null;
  planPriceMinor?: number;
  planInterval?: 'month' | 'year' | string;
  status: 'active' | 'suspended';
  createdAt: string;
  storesCount: number;
  monthlyGmvMinor: number;
}

export interface PlatformMetrics {
  totalTenants: number;
  activeStores: number;
  /** Null until billing/subscriptions are tracked. */
  platformArrMinor: number | null;
  monthlyGmvMinor: number;
  /** Null until latency telemetry is collected. */
  apiP95LatencyMs: number | null;
  systemHealth: 'healthy' | 'degraded' | 'incident';
}

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string | null;
  platformRole?: 'super_admin' | 'support' | 'viewer';
}

export async function login(email: string, password: string): Promise<void> {
  await request('/v1/auth/platform/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await request('/v1/auth/platform/logout', { method: 'POST' });
}

export async function getCurrentAdmin(): Promise<PlatformAdmin> {
  return request<PlatformAdmin>('/v1/auth/platform/me');
}

export async function getPlatformMetrics(init?: RequestInit): Promise<PlatformMetrics> {
  return request<PlatformMetrics>('/v1/platform/analytics', init);
}

export async function getPlatformTenants(init?: RequestInit): Promise<PlatformTenant[]> {
  return request<PlatformTenant[]>('/v1/platform/tenants', init);
}

export async function createTenant(input: {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerPassword: string;
  plan?: string;
}): Promise<PlatformTenant> {
  return request<PlatformTenant>('/v1/platform/tenants', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function setTenantStatus(id: string, status: 'active' | 'suspended'): Promise<PlatformTenant> {
  return request<PlatformTenant>(`/v1/platform/tenants/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export interface TenantStoreDetail {
  id: string;
  name: string;
  slug: string;
  currency: string;
  whatsappPhone: string | null;
  createdAt: string;
}

export interface TenantDetail {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  plan?: 'starter' | 'growth' | 'enterprise' | string;
  planPriceMinor?: number;
  planInterval?: 'month' | 'year' | string;
  createdAt: string;
  storeId: string | null;
  storeName: string | null;
  slug: string | null;
  whatsappPhone: string | null;
  monthlyGmvMinor: number;
  stores?: TenantStoreDetail[];
}

export async function getTenant(id: string, init?: RequestInit): Promise<TenantDetail> {
  return request<TenantDetail>(`/v1/platform/tenants/${encodeURIComponent(id)}`, init);
}

export async function updateTenant(
  id: string,
  input: {
    name?: string;
    storeName?: string;
    slug?: string;
    plan?: string;
    planPriceMinor?: number;
    planInterval?: string;
  }
): Promise<TenantDetail> {
  return request<TenantDetail>(`/v1/platform/tenants/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function addTenantStore(
  tenantId: string,
  input: { name: string; slug: string; whatsappPhone?: string }
): Promise<TenantDetail> {
  return request<TenantDetail>(`/v1/platform/tenants/${encodeURIComponent(tenantId)}/stores`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface TenantUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: 'active' | 'disabled';
  createdAt: string;
}

export async function getTenantUsers(tenantId: string): Promise<TenantUser[]> {
  return request<TenantUser[]>(`/v1/platform/tenants/${encodeURIComponent(tenantId)}/users`);
}

export async function createTenantUser(
  tenantId: string,
  input: { email: string; password: string; name?: string }
): Promise<TenantUser[]> {
  return request<TenantUser[]>(`/v1/platform/tenants/${encodeURIComponent(tenantId)}/users`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function setTenantUserStatus(
  tenantId: string,
  userId: string,
  status: 'active' | 'disabled'
): Promise<TenantUser[]> {
  return request<TenantUser[]>(
    `/v1/platform/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) }
  );
}

/** Sets a new password for a merchant user and signs them out everywhere. */
export async function resetMerchantPassword(userId: string, newPassword: string): Promise<void> {
  await request(`/v1/platform/users/${encodeURIComponent(userId)}/password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request('/v1/auth/platform/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/** Obtains a single-use 60-second exchange URL to log directly into merchant portal without a password. */
export async function impersonateTenant(
  tenantId: string,
  userId?: string
): Promise<{ token: string; targetUser: { id: string; email: string; name: string | null }; redirectUrl: string }> {
  return request<{ token: string; targetUser: { id: string; email: string; name: string | null }; redirectUrl: string }>(
    `/v1/platform/tenants/${encodeURIComponent(tenantId)}/impersonate`,
    {
      method: 'POST',
      body: JSON.stringify(userId ? { userId } : {}),
    }
  );
}

export interface PlatformAdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  platformRole?: 'super_admin' | 'support' | 'viewer';
  status: 'active' | 'disabled';
  createdAt: string;
}

export async function getPlatformAdmins(): Promise<PlatformAdminUser[]> {
  return request<PlatformAdminUser[]>('/v1/platform/admins');
}

export async function createPlatformAdmin(input: {
  email: string;
  password: string;
  name?: string;
  platformRole?: string;
}): Promise<PlatformAdminUser[]> {
  return request<PlatformAdminUser[]>('/v1/platform/admins', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function setPlatformAdminStatus(
  adminId: string,
  status: 'active' | 'disabled'
): Promise<PlatformAdminUser[]> {
  return request<PlatformAdminUser[]>(`/v1/platform/admins/${encodeURIComponent(adminId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function resetPlatformAdminPassword(adminId: string, newPassword: string): Promise<void> {
  await request(`/v1/platform/admins/${encodeURIComponent(adminId)}/password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export async function getAuditLogs(params?: {
  limit?: number;
  action?: string;
  targetType?: string;
}): Promise<AuditLog[]> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.action) query.set('action', params.action);
  if (params?.targetType) query.set('targetType', params.targetType);
  const qStr = query.toString();
  return request<AuditLog[]>(`/v1/platform/audit-logs${qStr ? `?${qStr}` : ''}`);
}

