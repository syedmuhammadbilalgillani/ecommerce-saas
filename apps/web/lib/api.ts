const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

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

export async function getStorefrontProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${API_URL}/v1/storefront/products`, {
      next: { revalidate: 60, tags: ['products'] }, // 60s ISR caching
    });
    if (!res.ok) throw new Error(`API error: ${res.statusText}`);
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('Failed to fetch products from API, falling back to local mock:', err);
    return [
      {
        id: 'prod_01',
        title: 'Essential Crewneck T-Shirt',
        slug: 'essential-crewneck-tshirt',
        description: '100% premium combed Pakistani cotton, breathable, pre-shrunk fabric.',
        categoryId: 'cat_tshirts',
        category: { id: 'cat_tshirts', name: 'T-Shirts', fullName: 'Apparel & Accessories > Clothing > Tops > T-Shirts' },
        isPublished: true,
        variants: [
          { id: 'var_01', title: 'Black / M', sku: 'OUTF-BLK-M', priceMinor: 249000, compareAtPriceMinor: 299000, stock: 50 },
          { id: 'var_02', title: 'Black / L', sku: 'OUTF-BLK-L', priceMinor: 249000, compareAtPriceMinor: 299000, stock: 35 },
        ],
      },
      {
        id: 'prod_02',
        title: 'Relaxed Fit Linen Shirt',
        slug: 'relaxed-fit-linen-shirt',
        description: 'Lightweight pure linen, ideal for summer in Karachi, Lahore, and Dubai.',
        categoryId: 'cat_shirts',
        category: { id: 'cat_shirts', name: 'Button-Down Shirts', fullName: 'Apparel & Accessories > Clothing > Tops > Shirts' },
        isPublished: true,
        variants: [
          { id: 'var_03', title: 'White / M', sku: 'LINEN-WHT-M', priceMinor: 499000, compareAtPriceMinor: 599000, stock: 20 },
        ],
      },
      {
        id: 'prod_03',
        title: 'Minimalist Leather Sneakers',
        slug: 'minimalist-leather-sneakers',
        description: 'Handcrafted genuine leather sneakers with cushioned ortholite insoles.',
        categoryId: 'cat_sneakers',
        category: { id: 'cat_sneakers', name: 'Sneakers & Shoes', fullName: 'Apparel & Accessories > Shoes > Sneakers' },
        isPublished: true,
        variants: [
          { id: 'var_05', title: 'White / 42 EU', sku: 'SNK-WHT-42', priceMinor: 899000, compareAtPriceMinor: 1099000, stock: 12 },
        ],
      },
    ];
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_URL}/v1/storefront/products/${slug}`, {
      next: { revalidate: 60, tags: [`product:${slug}`] },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    const fallbackList = await getStorefrontProducts();
    return fallbackList.find((p) => p.slug === slug) || null;
  }
}

export async function getStorefrontCollections(): Promise<StorefrontCollection[]> {
  try {
    const res = await fetch(`${API_URL}/v1/storefront/collections`, {
      next: { revalidate: 60, tags: ['collections'] },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data || [];
    }
  } catch {}
  return [
    { id: 'col_summer', title: 'Summer 2026', slug: 'summer-2026', description: 'Lightweight linen & breathable cottons for peak summer.' },
    { id: 'col_mens', title: "Men's Apparel", slug: 'mens-apparel', description: 'Curated menswear essentials handcrafted for comfort.' },
    { id: 'col_bestsellers', title: 'Best Sellers', slug: 'best-sellers', description: 'Most-ordered pieces across Pakistan.' },
  ];
}

export async function getStorefrontCollection(slug: string): Promise<StorefrontCollection | null> {
  try {
    const res = await fetch(`${API_URL}/v1/storefront/collections/${slug}`, {
      next: { revalidate: 60, tags: [`collection:${slug}`] },
    });
    if (res.ok) {
      const json = await res.json();
      return json.data || null;
    }
  } catch {}
  const list = await getStorefrontCollections();
  return list.find(c => c.slug === slug) || null;
}
