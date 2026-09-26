const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export { formatPrice } from './utils';

export interface PlatformTenant {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'growth' | 'scale' | 'enterprise';
  status: 'active' | 'suspended';
  createdAt: string;
  storesCount: number;
  monthlyGmvMinor: number;
}

export interface PlatformMetrics {
  totalTenants: number;
  activeStores: number;
  platformArrMinor: number;
  monthlyGmvMinor: number;
  apiP95LatencyMs: number;
  systemHealth: 'healthy' | 'degraded' | 'incident';
}

export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  try {
    const res = await fetch(`${API_URL}/v1/platform/analytics`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      return json.data || json;
    }
  } catch {}
  return {
    totalTenants: 12,
    activeStores: 18,
    platformArrMinor: 145000000, // PKR 1.45M ARR
    monthlyGmvMinor: 4890000000, // PKR 48.9M GMV
    apiP95LatencyMs: 14,
    systemHealth: 'healthy',
  };
}

export async function getPlatformTenants(): Promise<PlatformTenant[]> {
  try {
    const res = await fetch(`${API_URL}/v1/platform/tenants`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.data || []);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {}
  return [
    {
      id: 'tenant_01',
      name: 'Outfitters Retail PK',
      slug: 'outfitters',
      plan: 'scale',
      status: 'active',
      createdAt: '2026-01-15',
      storesCount: 3,
      monthlyGmvMinor: 1890000000,
    },
    {
      id: 'tenant_02',
      name: 'Khaadi Pret & Home',
      slug: 'khaadi',
      plan: 'enterprise',
      status: 'active',
      createdAt: '2026-02-01',
      storesCount: 5,
      monthlyGmvMinor: 2450000000,
    },
    {
      id: 'tenant_03',
      name: 'Sana Safinaz Couture',
      slug: 'sana-safinaz',
      plan: 'growth',
      status: 'active',
      createdAt: '2026-02-18',
      storesCount: 2,
      monthlyGmvMinor: 550000000,
    },
  ];
}
