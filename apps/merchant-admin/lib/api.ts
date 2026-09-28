// Browser calls go through this app's own /api rewrite (see next.config.mjs) so session
// cookies are first-party. Server components call the API directly and forward cookies.
const API_URL =
  typeof window === 'undefined' ? process.env.API_URL || '' : '/api';

export { formatPrice } from './utils';

/** Thrown when the API says the merchant is not signed in (or the session expired). */
export class AuthError extends Error {}

/**
 * Calls the API and returns `data` from the `{ success, data }` envelope.
 * Throws with the API's own message on any failure — callers must surface it,
 * never pretend the action succeeded.
 *
 * In the browser the session cookie is sent automatically. Server components must pass
 * the incoming cookie header via `init.headers` (see `serverAuthHeaders`).
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const activeStoreId = typeof window !== 'undefined' ? localStorage.getItem('posflow_active_store_id') : null;
  const storeHeader: Record<string, string> = activeStoreId ? { 'x-store-id': activeStoreId } : {};

  try {
    res = await fetch(`${API_URL}${path}`, {
      cache: 'no-store',
      credentials: 'include',
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...storeHeader,
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

// ----------------------------------------------------
// Auth API
// ----------------------------------------------------
export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  currency: string;
}

export interface CurrentMerchant {
  id: string;
  email: string;
  name: string | null;
  tenantId: string;
  storeId: string;
  storeName: string;
  stores?: StoreSummary[];
}

export async function login(email: string, password: string): Promise<void> {
  await request('/v1/auth/merchant/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await request('/v1/auth/merchant/logout', { method: 'POST' });
}

export async function getCurrentMerchant(): Promise<CurrentMerchant> {
  return request<CurrentMerchant>('/v1/auth/merchant/me');
}

export interface TaxonomyCategory {
  id: string;
  name: string;
  fullName: string;
  parentId?: string | null;
  level?: number;
}

export interface StoreCollection {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  collectionType?: string;
  collectionProducts?: Array<{ id: string; productId: string }>;
}

export interface MerchantProductVariant {
  id: string;
  title: string;
  sku: string;
  priceMinor: number;
  compareAtPriceMinor?: number | null;
  stock: number;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
}

export interface MerchantProductImage {
  id: string;
  url: string;
  altText?: string | null;
  position: number;
}

export interface MerchantProduct {
  id: string;
  storeId: string;
  categoryId?: string | null;
  category?: TaxonomyCategory | null;
  title: string;
  slug: string;
  description?: string | null;
  productType?: string | null;
  vendor?: string | null;
  tags?: string[];
  options?: Array<{ name: string; values: string[] }> | null;
  isPublished: boolean;
  variants: MerchantProductVariant[];
  images: MerchantProductImage[];
}

export interface MerchantOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerCity: string;
  shippingAddress: string;
  shippingAddressLine2?: string | null;
  shippingProvince?: string | null;
  shippingPostalCode?: string | null;
  paymentMethod: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  orderStatus?: string;
  discountCode?: string | null;
  discountMinor?: number;
  totalMinor: number;
  subtotalMinor: number;
  shippingFeeMinor: number;
  status: string;
  courierName?: string | null;
  courierTrackingNumber?: string | null;
  courierStatus?: string | null;
  notes?: string | null;
  whatsappVerified?: boolean;
  createdAt: string;
  items: Array<{
    id: string;
    productTitle: string;
    variantTitle: string;
    sku: string;
    quantity: number;
    unitPriceMinor: number;
    totalMinor: number;
  }>;
}

export function formatWhatsAppUrl(phone: string, message?: string): string {
  if (!phone) return '#';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '92' + cleaned.substring(1);
  } else if (!cleaned.startsWith('92') && cleaned.length === 10 && cleaned.startsWith('3')) {
    cleaned = '92' + cleaned;
  }
  const textParam = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${cleaned}${textParam}`;
}

function mapRawOrder(o: any): MerchantOrder {
  const orderStatus = o.orderStatus || 'open';
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail || null,
    customerCity: o.shippingCity || '',
    shippingAddress: o.shippingAddressLine1 || '',
    shippingAddressLine2: o.shippingAddressLine2 || null,
    shippingProvince: o.shippingProvince || null,
    shippingPostalCode: o.shippingPostalCode || null,
    paymentMethod: o.paymentMethod,
    financialStatus: o.financialStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    orderStatus,
    discountCode: o.discountCode || null,
    discountMinor: o.discountMinor || 0,
    totalMinor: o.totalMinor,
    subtotalMinor: o.subtotalMinor,
    shippingFeeMinor: o.shippingFeeMinor,
    status: orderStatus === 'cancelled' ? 'cancelled' : o.fulfillmentStatus === 'unfulfilled' ? 'pending' : o.fulfillmentStatus,
    courierName: o.courierName,
    courierTrackingNumber: o.courierTrackingNumber,
    courierStatus: o.courierStatus,
    notes: o.notes,
    whatsappVerified: !!(o.notes && o.notes.includes('WhatsApp Verified')),
    createdAt: o.createdAt,
    items: (o.items || []).map((i: any) => ({
      id: i.id,
      productTitle: i.title,
      variantTitle: i.variantTitle,
      sku: i.sku,
      quantity: i.quantity,
      unitPriceMinor: i.unitPriceMinor,
      totalMinor: i.totalMinor,
    })),
  };
}

// ----------------------------------------------------
// Orders API
// ----------------------------------------------------
export type OrderTab = 'all' | 'unverified' | 'pending_dispatch' | 'in_transit' | 'delivered' | 'cancelled';
export type OrderTabCounts = Record<OrderTab, number>;

export interface OrderPage {
  orders: MerchantOrder[];
  nextCursor: string | null;
  counts: OrderTabCounts;
}

function queryString(params: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Raw fetch that keeps the page envelope (data + nextCursor + extras) instead of unwrapping `data`. */
async function requestPage<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      cache: 'no-store',
      credentials: 'include',
      ...init,
    });
  } catch {
    throw new Error('Cannot reach the API server. Check that it is running.');
  }
  const json = await res.json().catch(() => null);
  if (res.status === 401) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') window.location.assign('/login');
    throw new AuthError(json?.message || 'Please sign in');
  }
  if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
  return json as T;
}

export async function getOrders(
  params: { tab?: OrderTab; q?: string; cursor?: string | null; limit?: number } = {},
  init?: RequestInit
): Promise<OrderPage> {
  const page = await requestPage<{ data: any[]; nextCursor: string | null; counts: OrderTabCounts }>(
    `/v1/merchant/orders${queryString({ tab: params.tab, q: params.q, cursor: params.cursor, limit: params.limit })}`,
    init
  );
  return { orders: page.data.map(mapRawOrder), nextCursor: page.nextCursor, counts: page.counts };
}

export async function getOrderById(orderId: string): Promise<MerchantOrder> {
  return mapRawOrder(await request<any>(`/v1/merchant/orders/${encodeURIComponent(orderId)}`));
}

export async function updateOrderNotes(orderId: string, notes: string): Promise<MerchantOrder> {
  return mapRawOrder(
    await request<any>(`/v1/merchant/orders/${encodeURIComponent(orderId)}/notes`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    })
  );
}

export async function bookCourier(orderId: string, courierName: string = 'Trax'): Promise<MerchantOrder> {
  return mapRawOrder(
    await request<any>(`/v1/merchant/orders/${encodeURIComponent(orderId)}/book-courier`, {
      method: 'POST',
      body: JSON.stringify({ courierName }),
    })
  );
}

/** Maps the admin's single status dropdown onto the API's order/fulfillment fields. */
export async function updateOrderStatus(orderId: string, status: string): Promise<MerchantOrder> {
  const body =
    status === 'cancelled'
      ? { orderStatus: 'cancelled', fulfillmentStatus: 'cancelled' }
      : { orderStatus: 'open', fulfillmentStatus: status === 'pending' ? 'unfulfilled' : status };
  return mapRawOrder(
    await request<any>(`/v1/merchant/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  );
}

export async function verifyWhatsAppOrder(orderId: string, verifiedBy: 'customer' | 'merchant' = 'merchant'): Promise<MerchantOrder> {
  return mapRawOrder(
    await request<any>(`/v1/merchant/orders/${encodeURIComponent(orderId)}/verify-whatsapp`, {
      method: 'POST',
      body: JSON.stringify({ verifiedBy }),
    })
  );
}

// ----------------------------------------------------
// Catalog API
// ----------------------------------------------------
export async function getMerchantProducts(): Promise<MerchantProduct[]> {
  return request<MerchantProduct[]>('/v1/merchant/products');
}

export async function createMerchantProduct(data: unknown): Promise<MerchantProduct> {
  return request<MerchantProduct>('/v1/merchant/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getCategories(): Promise<TaxonomyCategory[]> {
  return request<TaxonomyCategory[]>('/v1/merchant/categories');
}

export async function getCollections(): Promise<StoreCollection[]> {
  return request<StoreCollection[]>('/v1/merchant/collections');
}

export async function createCollection(data: unknown): Promise<StoreCollection> {
  return request<StoreCollection>('/v1/merchant/collections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ----------------------------------------------------
// Discounts API
// ----------------------------------------------------
export interface MerchantDiscount {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping';
  value: number;
  appliesTo: string;
  minRequirementType: string;
  minSubtotalMinor: number;
  usageLimit?: number | null;
  timesUsed: number;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string | null;
}

export async function getDiscounts(): Promise<MerchantDiscount[]> {
  return request<MerchantDiscount[]>('/v1/merchant/discounts');
}

export async function createDiscount(data: unknown): Promise<MerchantDiscount> {
  return request<MerchantDiscount>('/v1/merchant/discounts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ----------------------------------------------------
// Customers CRM API
// ----------------------------------------------------
export interface MerchantCustomer {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  phone: string;
  email?: string | null;
  ordersCount: number;
  totalSpentMinor: number;
  avgOrderValueMinor?: number;
  state: string;
  tags: string[];
  notes?: string | null;
  defaultAddress?: any;
  createdAt?: string;
  orders?: MerchantOrder[];
}

export interface CustomerPage {
  customers: MerchantCustomer[];
  nextCursor: string | null;
  stats: { total: number; repeat: number; avgLifetimeValueMinor: number };
}

export async function getCustomers(params: { q?: string; cursor?: string | null; limit?: number } = {}): Promise<CustomerPage> {
  const page = await requestPage<{ data: MerchantCustomer[]; nextCursor: string | null; stats: CustomerPage['stats'] }>(
    `/v1/merchant/customers${queryString({ q: params.q, cursor: params.cursor, limit: params.limit })}`
  );
  return { customers: page.data, nextCursor: page.nextCursor, stats: page.stats };
}

export async function getCustomerById(id: string): Promise<MerchantCustomer> {
  const customer = await request<any>(`/v1/merchant/customers/${encodeURIComponent(id)}`);
  return { ...customer, orders: (customer.orders || []).map(mapRawOrder) };
}

// ----------------------------------------------------
// Analytics & Reports API
// ----------------------------------------------------
export interface MerchantAnalytics {
  grossSalesMinor: number;
  netSalesMinor: number;
  discountsMinor: number;
  totalOrders: number;
  totalUnits: number;
  deliveredOrders: number;
  averageOrderValueMinor: number;
  pendingCodMinor: number;
  rtoRatePercent: number;
  totalCustomers: number;
  repeatCustomersRate: number;
  salesOverTime: Array<{
    date: string;
    salesMinor: number;
    ordersCount: number;
  }>;
  topProducts: Array<{
    title: string;
    variantTitle: string;
    unitsSold: number;
    revenueMinor: number;
  }>;
  cityBreakdown: Array<{
    city: string;
    ordersCount: number;
    revenueMinor: number;
    percentage: number;
  }>;
  paymentBreakdown: Array<{
    method: string;
    ordersCount: number;
    revenueMinor: number;
  }>;
}

export async function getAnalytics(init?: RequestInit): Promise<MerchantAnalytics> {
  return request<MerchantAnalytics>('/v1/merchant/analytics', init);
}

// ----------------------------------------------------
// Store settings & account
// ----------------------------------------------------
export interface StoreSettings {
  id: string;
  name: string;
  slug: string;
  currency: string;
  whatsappPhone: string | null;
}

export async function getStoreSettings(): Promise<StoreSettings> {
  return request<StoreSettings>('/v1/merchant/store');
}

export async function updateStoreSettings(data: { name?: string; whatsappPhone?: string | null }): Promise<StoreSettings> {
  return request<StoreSettings>('/v1/merchant/store', { method: 'PATCH', body: JSON.stringify(data) });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request('/v1/auth/merchant/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// ----------------------------------------------------
// Product editing & inventory
// ----------------------------------------------------
export async function updateProduct(productId: string, data: Record<string, unknown>): Promise<MerchantProduct> {
  return request<MerchantProduct>(`/v1/merchant/products/${encodeURIComponent(productId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateVariant(
  productId: string,
  variantId: string,
  data: {
    title?: string;
    sku?: string;
    priceMinor?: number;
    compareAtPriceMinor?: number | null;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
  }
): Promise<MerchantProduct> {
  return request<MerchantProduct>(
    `/v1/merchant/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
    { method: 'PATCH', body: JSON.stringify(data) }
  );
}

/** Replaces a product's full image list, in the given order. */
export async function setProductImages(
  productId: string,
  images: Array<{ url: string; altText?: string | null }>
): Promise<MerchantProduct> {
  return request<MerchantProduct>(`/v1/merchant/products/${encodeURIComponent(productId)}/images`, {
    method: 'PATCH',
    body: JSON.stringify({ images }),
  });
}

/** Adds (positive) or removes (negative) stock. */
export async function adjustStock(productId: string, variantId: string, delta: number): Promise<MerchantProduct> {
  return request<MerchantProduct>(
    `/v1/merchant/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/stock-adjustments`,
    { method: 'POST', body: JSON.stringify({ delta }) }
  );
}

export async function setDiscountActive(discountId: string, isActive: boolean): Promise<MerchantDiscount> {
  return request<MerchantDiscount>(`/v1/merchant/discounts/${encodeURIComponent(discountId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}
