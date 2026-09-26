export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

/** Which store this storefront deployment sells for. The API rejects unknown or suspended stores. */
export const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID || 'store_default';

export function storefrontHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { 'x-store-id': STORE_ID, ...extra };
}

export interface ProductVariant {
  id: string;
  title: string;
  sku: string;
  priceMinor: number;
  compareAtPriceMinor?: number | null;
  stock: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  fullName: string;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  categoryId?: string | null;
  category?: ProductCategory | null;
  productType?: string | null;
  vendor?: string | null;
  tags?: string[];
  isPublished: boolean;
  variants: ProductVariant[];
}

export interface StorefrontCollection {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  collectionProducts?: Array<{
    id: string;
    product: Product;
  }>;
}

export function formatPrice(amountMinor: number, currency: string = 'PKR'): string {
  const major = amountMinor / 100;
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(major);
}

async function fetchData<T>(path: string, init: RequestInit & { next?: { revalidate?: number; tags?: string[] } }): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: storefrontHeaders() });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return json.data as T;
}

/** Like fetchData, but a 404 means "doesn't exist" and returns null. */
async function fetchOptional<T>(path: string, init: RequestInit & { next?: { revalidate?: number; tags?: string[] } }): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: storefrontHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return (json.data as T) ?? null;
}

// Errors are thrown on purpose: with ISR, Next keeps serving the last good page
// instead of caching a fake catalog when the API is briefly unreachable.
export async function getStorefrontProducts(): Promise<Product[]> {
  return fetchData<Product[]>('/v1/storefront/products', {
    next: { revalidate: 60, tags: ['products'] },
  });
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return fetchOptional<Product>(`/v1/storefront/products/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60, tags: [`product:${slug}`] },
  });
}

export async function getStorefrontCollections(): Promise<StorefrontCollection[]> {
  return fetchData<StorefrontCollection[]>('/v1/storefront/collections', {
    next: { revalidate: 60, tags: ['collections'] },
  });
}

export async function getStorefrontCollection(slug: string): Promise<StorefrontCollection | null> {
  return fetchOptional<StorefrontCollection>(`/v1/storefront/collections/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60, tags: [`collection:${slug}`] },
  });
}

export interface StoreInfo {
  id: string;
  name: string;
  currency: string;
  /** E.164, e.g. +923001234567; null when the merchant hasn't set one. */
  whatsappPhone: string | null;
}

export async function getStoreInfo(): Promise<StoreInfo> {
  return fetchData<StoreInfo>('/v1/storefront/store', {
    next: { revalidate: 60, tags: ['store'] },
  });
}
