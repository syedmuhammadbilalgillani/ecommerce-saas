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
  /** Subscription plans are not stored yet, so this is always null for now. */
  plan: string | null;
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
