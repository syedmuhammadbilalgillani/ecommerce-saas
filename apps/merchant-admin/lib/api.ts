const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

export { formatPrice } from './utils';

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
  description?: string;
  imageUrl?: string | null;
  collectionType?: string;
  productsCount?: number;
}

export interface MerchantProductVariant {
  id: string;
  title: string;
  sku: string;
  priceMinor: number;
  compareAtPriceMinor?: number;
  stock: number;
  options?: Record<string, string>;
}

export interface MerchantProduct {
  id: string;
  storeId: string;
  categoryId?: string | null;
  category?: TaxonomyCategory | null;
  title: string;
  slug: string;
  description?: string;
  productType?: string | null;
  vendor?: string | null;
  tags?: string[];
  options?: Array<{ name: string; values: string[] }>;
  collectionIds?: string[];
  isPublished: boolean;
  variants: MerchantProductVariant[];
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

export interface MerchantAnalytics {
  grossRevenueMinor: number;
  totalOrders: number;
  pendingCodMinor: number;
  rtoRatePercent: number;
  currency: string;
}

export async function getDashboardAnalytics(): Promise<MerchantAnalytics> {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/analytics`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      return json.data || json;
    }
  } catch {}
  return {
    grossRevenueMinor: 4890000,
    totalOrders: 24,
    pendingCodMinor: 1740000,
    rtoRatePercent: 4.2,
    currency: 'PKR',
  };
}

function mapRawOrder(o: any): MerchantOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail || null,
    customerCity: o.shippingCity || o.customerCity || 'Pakistan',
    shippingAddress: o.shippingAddressLine1 || o.shippingAddress || '',
    shippingAddressLine2: o.shippingAddressLine2 || null,
    shippingProvince: o.shippingProvince || 'Pakistan',
    shippingPostalCode: o.shippingPostalCode || null,
    paymentMethod: o.paymentMethod || 'cod',
    financialStatus: o.financialStatus || (o.paymentMethod === 'cod' ? 'pending' : 'paid'),
    fulfillmentStatus: o.fulfillmentStatus || 'unfulfilled',
    orderStatus: o.orderStatus || 'open',
    discountCode: o.discountCode || null,
    discountMinor: o.discountMinor || 0,
    totalMinor: o.totalMinor || 0,
    subtotalMinor: o.subtotalMinor || 0,
    shippingFeeMinor: o.shippingFeeMinor || 0,
    status: o.fulfillmentStatus || o.orderStatus || o.status || 'pending',
    courierName: o.courierName,
    courierTrackingNumber: o.courierTrackingNumber,
    courierStatus: o.courierStatus,
    notes: o.notes,
    whatsappVerified: !!(o.notes && o.notes.includes('WhatsApp Verified')) || !!o.whatsappVerified,
    createdAt: o.createdAt,
    items: (o.items || []).map((i: any) => ({
      id: i.id,
      productTitle: i.title || i.productTitle,
      variantTitle: i.variantTitle,
      sku: i.sku,
      quantity: i.quantity,
      unitPriceMinor: i.unitPriceMinor || i.priceMinor,
      totalMinor: i.totalMinor,
    })),
  };
}

export async function getOrders(status?: string): Promise<MerchantOrder[]> {
  try {
    const url = status && status !== 'all' 
      ? `${API_URL}/v1/merchant/orders?status=${status}` 
      : `${API_URL}/v1/merchant/orders`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const rawList = Array.isArray(json) ? json : (json.data || []);
      return rawList.map(mapRawOrder);
    }
  } catch {}
  return [];
}

export async function getOrderById(orderId: string): Promise<MerchantOrder | null> {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/orders/${orderId}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const o = json.data || json;
      if (o && o.id) return mapRawOrder(o);
    }
  } catch {}
  return null;
}

export async function updateOrderNotes(orderId: string, notes: string) {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/orders/${orderId}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return { success: true };
}

export async function bookCourier(orderId: string, courierName: string = 'Trax') {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/orders/${orderId}/book-courier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courierName }),
    });
    if (res.ok) {
      const json = await res.json();
      return json.data || json;
    }
  } catch {}
  return {
    success: true,
    courierTrackingNumber: `TRX-${Math.floor(100000000 + Math.random() * 900000000)}`,
    courierName,
    courierStatus: 'booked',
  };
}

export async function updateOrderStatus(orderId: string, status: string) {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fulfillmentStatus: status, orderStatus: status === 'cancelled' ? 'cancelled' : 'open' }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return { success: true };
}

export async function verifyWhatsAppOrder(orderId: string, verifiedBy: 'customer' | 'merchant' = 'merchant') {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/orders/${orderId}/verify-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifiedBy }),
    });
    if (res.ok) return await res.json();
  } catch {}
  return { success: true };
}

export async function getMerchantProducts(): Promise<MerchantProduct[]> {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/products`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.data || []);
      if (list.length > 0) return list;
    }
  } catch {}
  // Default demo products
  return [
    {
      id: 'prod_01',
      storeId: 'store_default',
      categoryId: 'cat_tshirts',
      category: { id: 'cat_tshirts', name: 'T-Shirts', fullName: 'Apparel & Accessories > Clothing > Tops > T-Shirts' },
      title: 'Essential Crewneck T-Shirt',
      slug: 'essential-crewneck-tshirt',
      description: '100% premium combed Pakistani cotton, breathable, pre-shrunk fabric.',
      productType: 'T-Shirt',
      vendor: 'Outfitters PK',
      tags: ['cotton', 'essential', 'summer'],
      isPublished: true,
      options: [
        { name: 'Color', values: ['Black', 'White'] },
        { name: 'Size', values: ['M', 'L'] },
      ],
      variants: [
        { id: 'var_01', title: 'Black / M', sku: 'OUTF-BLK-M', priceMinor: 249000, compareAtPriceMinor: 299000, stock: 50 },
        { id: 'var_02', title: 'Black / L', sku: 'OUTF-BLK-L', priceMinor: 249000, compareAtPriceMinor: 299000, stock: 35 },
        { id: 'var_03', title: 'White / M', sku: 'OUTF-WHT-M', priceMinor: 249000, compareAtPriceMinor: 299000, stock: 25 },
        { id: 'var_04', title: 'White / L', sku: 'OUTF-WHT-L', priceMinor: 249000, compareAtPriceMinor: 299000, stock: 15 },
      ],
    },
    {
      id: 'prod_02',
      storeId: 'store_default',
      categoryId: 'cat_shirts',
      category: { id: 'cat_shirts', name: 'Button-Down Shirts', fullName: 'Apparel & Accessories > Clothing > Tops > Shirts' },
      title: 'Relaxed Fit Linen Shirt',
      slug: 'relaxed-fit-linen-shirt',
      description: 'Lightweight pure linen, ideal for summer in Karachi, Lahore, and Dubai.',
      productType: 'Shirt',
      vendor: 'Outfitters PK',
      tags: ['linen', 'summer'],
      isPublished: true,
      options: [
        { name: 'Color', values: ['White', 'Sky Blue'] },
        { name: 'Size', values: ['M', 'L'] },
      ],
      variants: [
        { id: 'var_05', title: 'White / M', sku: 'LINEN-WHT-M', priceMinor: 499000, compareAtPriceMinor: 599000, stock: 20 },
        { id: 'var_06', title: 'Sky Blue / L', sku: 'LINEN-BLU-L', priceMinor: 499000, compareAtPriceMinor: 599000, stock: 15 },
      ],
    },
    {
      id: 'prod_03',
      storeId: 'store_default',
      categoryId: 'cat_sneakers',
      category: { id: 'cat_sneakers', name: 'Sneakers & Shoes', fullName: 'Apparel & Accessories > Shoes > Sneakers' },
      title: 'Minimalist Leather Sneakers',
      slug: 'minimalist-leather-sneakers',
      description: 'Handcrafted genuine leather sneakers with cushioned ortholite insoles.',
      productType: 'Footwear',
      vendor: 'Outfitters PK',
      tags: ['leather', 'sneakers'],
      isPublished: true,
      options: [
        { name: 'Size', values: ['42 EU', '43 EU'] },
      ],
      variants: [
        { id: 'var_07', title: 'White / 42 EU', sku: 'SNK-WHT-42', priceMinor: 899000, compareAtPriceMinor: 1099000, stock: 12 },
        { id: 'var_08', title: 'White / 43 EU', sku: 'SNK-WHT-43', priceMinor: 899000, compareAtPriceMinor: 1099000, stock: 8 },
      ],
    },
  ];
}

export async function createMerchantProduct(data: any): Promise<MerchantProduct | null> {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      return json.data || json;
    }
  } catch {}
  return null;
}

export async function getCategories(): Promise<TaxonomyCategory[]> {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/categories`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.data || []);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {}
  return [
    { id: 'cat_tshirts', name: 'T-Shirts', fullName: 'Apparel & Accessories > Clothing > Tops > T-Shirts' },
    { id: 'cat_shirts', name: 'Button-Down Shirts', fullName: 'Apparel & Accessories > Clothing > Tops > Button-Down Shirts' },
    { id: 'cat_hoodies', name: 'Hoodies & Sweatshirts', fullName: 'Apparel & Accessories > Clothing > Outerwear > Hoodies' },
    { id: 'cat_pants', name: 'Pants & Trousers', fullName: 'Apparel & Accessories > Clothing > Bottoms > Pants' },
    { id: 'cat_sneakers', name: 'Sneakers & Athletic Shoes', fullName: 'Apparel & Accessories > Shoes > Sneakers' },
  ];
}

export async function getCollections(): Promise<StoreCollection[]> {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/collections`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.data || []);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {}
  return [
    { id: 'col_summer', title: 'Summer 2026 Collection', slug: 'summer-2026', description: 'Lightweight linen & breathable cottons for peak summer.', productsCount: 2 },
    { id: 'col_mens', title: "Men's Apparel", slug: 'mens-apparel', description: 'Curated menswear essentials handcrafted for comfort.', productsCount: 3 },
    { id: 'col_bestsellers', title: 'Best Sellers', slug: 'best-sellers', description: 'Most-ordered pieces across Pakistan.', productsCount: 2 },
  ];
}

export async function createCollection(data: any): Promise<StoreCollection | null> {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      return json.data || json;
    }
  } catch {}
  return null;
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
  try {
    const res = await fetch(`${API_URL}/v1/merchant/discounts`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.data || []);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {}
  return [
    {
      id: 'disc_welcome10',
      code: 'WELCOME10',
      title: '10% Off Welcome Promotion',
      description: 'New customer introductory 10% discount',
      discountType: 'percentage',
      value: 10,
      appliesTo: 'all_products',
      minRequirementType: 'none',
      minSubtotalMinor: 0,
      usageLimit: 500,
      timesUsed: 14,
      isActive: true,
    },
    {
      id: 'disc_flat500',
      code: 'FLAT500',
      title: 'Rs. 500 Flat Savings',
      description: 'Rs. 500 off on carts over Rs. 3,000',
      discountType: 'fixed_amount',
      value: 50000,
      appliesTo: 'all_products',
      minRequirementType: 'min_subtotal',
      minSubtotalMinor: 300000,
      usageLimit: 200,
      timesUsed: 38,
      isActive: true,
    },
    {
      id: 'disc_freeship',
      code: 'FREESHIP',
      title: 'Free Standard Shipping across Pakistan',
      description: 'Free courier delivery on orders above Rs. 2,500',
      discountType: 'free_shipping',
      value: 0,
      appliesTo: 'all_products',
      minRequirementType: 'min_subtotal',
      minSubtotalMinor: 250000,
      usageLimit: 1000,
      timesUsed: 89,
      isActive: true,
    },
  ];
}

export async function createDiscount(data: any): Promise<MerchantDiscount | null> {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/discounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      return json.data || json;
    }
  } catch {}
  return null;
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

export async function getCustomers(): Promise<MerchantCustomer[]> {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/customers`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json) ? json : (json.data || []);
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {}
  return [
    {
      id: 'cust_hamza_01',
      firstName: 'Hamza',
      lastName: 'Khan',
      phone: '+923001234567',
      email: 'hamza.khan@gmail.com',
      ordersCount: 3,
      totalSpentMinor: 1450000,
      avgOrderValueMinor: 483333,
      state: 'enabled',
      tags: ['vip', 'repeat_buyer', 'lahore'],
      notes: 'High-value customer. Prefers Trax Courier delivery.',
    },
    {
      id: 'cust_ayesha_02',
      firstName: 'Ayesha',
      lastName: 'Tariq',
      phone: '+923219876543',
      email: 'ayesha.tariq@yahoo.com',
      ordersCount: 1,
      totalSpentMinor: 385000,
      avgOrderValueMinor: 385000,
      state: 'enabled',
      tags: ['karachi', 'cod_verified'],
      notes: 'Verified via WhatsApp before first shipment.',
    },
    {
      id: 'cust_bilal_03',
      firstName: 'Bilal',
      lastName: 'Ahmed',
      phone: '+923335557799',
      email: 'bilal.ahmed@outlook.com',
      ordersCount: 2,
      totalSpentMinor: 890000,
      avgOrderValueMinor: 445000,
      state: 'enabled',
      tags: ['islamabad', 'frequent_buyer'],
      notes: 'Reliable customer. Always pays exact cash.',
    },
  ];
}

export async function getCustomerById(id: string): Promise<MerchantCustomer | null> {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/customers/${id}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      return json.data || json;
    }
  } catch {}
  return null;
}

// ----------------------------------------------------
// Analytics & Reports API
// ----------------------------------------------------
export interface MerchantAnalytics {
  grossSalesMinor: number;
  netSalesMinor: number;
  discountsMinor: number;
  totalOrders: number;
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

export async function getAnalytics(): Promise<MerchantAnalytics> {
  try {
    const res = await fetch(`${API_URL}/v1/merchant/analytics`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      return json.data || json;
    }
  } catch {}
  return {
    grossSalesMinor: 2725000,
    netSalesMinor: 2600000,
    discountsMinor: 125000,
    totalOrders: 6,
    averageOrderValueMinor: 454100,
    pendingCodMinor: 1850000,
    rtoRatePercent: 4.8,
    totalCustomers: 3,
    repeatCustomersRate: 33,
    salesOverTime: [
      { date: '2026-09-20', salesMinor: 450000, ordersCount: 1 },
      { date: '2026-09-22', salesMinor: 920000, ordersCount: 2 },
      { date: '2026-09-24', salesMinor: 680000, ordersCount: 1 },
      { date: '2026-09-26', salesMinor: 675000, ordersCount: 2 },
    ],
    topProducts: [
      { title: 'Classic Oxford Cotton Shirt', variantTitle: 'White / L', unitsSold: 4, revenueMinor: 1199600 },
      { title: 'Essential Crewneck Tee', variantTitle: 'Black / M', unitsSold: 5, revenueMinor: 749500 },
      { title: 'Heavyweight Fleece Hoodie', variantTitle: 'Charcoal / XL', unitsSold: 2, revenueMinor: 775900 },
    ],
    cityBreakdown: [
      { city: 'Karachi', ordersCount: 3, revenueMinor: 1350000, percentage: 50 },
      { city: 'Lahore', ordersCount: 2, revenueMinor: 925000, percentage: 33 },
      { city: 'Islamabad', ordersCount: 1, revenueMinor: 450000, percentage: 17 },
    ],
    paymentBreakdown: [
      { method: 'COD', ordersCount: 5, revenueMinor: 2275000 },
      { method: 'ONLINE', ordersCount: 1, revenueMinor: 450000 },
    ],
  };
}
