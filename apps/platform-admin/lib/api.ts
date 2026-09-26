const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export { formatPrice } from './utils';

/** Calls the API and unwraps `data`; throws with the API's own message on failure. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      cache: 'no-store',
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

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  return request<PlatformMetrics>('/v1/platform/analytics');
}

export async function getPlatformTenants(): Promise<PlatformTenant[]> {
  return request<PlatformTenant[]>('/v1/platform/tenants');
}

export async function createTenant(input: { name: string; slug: string }): Promise<PlatformTenant> {
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
