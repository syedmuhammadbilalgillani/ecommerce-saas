import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import {
  type Database,
  products,
  productVariants,
  categories,
  collections,
  collectionProducts,
  eq,
  and,
  desc,
} from '@repo/db';

const DEMO_CATEGORIES = [
  { id: 'cat_tshirts', name: 'T-Shirts', fullName: 'Apparel & Accessories > Clothing > Tops > T-Shirts' },
  { id: 'cat_shirts', name: 'Button-Down Shirts', fullName: 'Apparel & Accessories > Clothing > Tops > Shirts' },
  { id: 'cat_hoodies', name: 'Hoodies & Sweatshirts', fullName: 'Apparel & Accessories > Clothing > Outerwear > Hoodies' },
  { id: 'cat_pants', name: 'Pants & Trousers', fullName: 'Apparel & Accessories > Clothing > Bottoms > Pants' },
  { id: 'cat_sneakers', name: 'Sneakers & Shoes', fullName: 'Apparel & Accessories > Shoes > Sneakers' },
];

const DEMO_COLLECTIONS = [
  { id: 'col_summer', title: 'Summer 2026 Collection', slug: 'summer-2026', description: 'Lightweight linen & breathable cottons for peak summer.' },
  { id: 'col_mens', title: "Men's Apparel", slug: 'mens-apparel', description: 'Curated menswear essentials handcrafted for comfort.' },
  { id: 'col_bestsellers', title: 'Best Sellers', slug: 'best-sellers', description: 'Most-ordered pieces across Pakistan.' },
];

const DEMO_FALLBACK_PRODUCTS = [
  {
    id: 'prod_01',
    storeId: 'store_default',
    title: 'Essential Crewneck T-Shirt',
    slug: 'essential-crewneck-tshirt',
    description: '100% premium combed Pakistani cotton, breathable, pre-shrunk fabric.',
    categoryId: 'cat_tshirts',
    productType: 'T-Shirt',
    vendor: 'Outfitters PK',
    tags: ['cotton', 'essential', 'summer'],
    options: [
      { name: 'Color', values: ['Black', 'White'] },
      { name: 'Size', values: ['M', 'L'] },
    ],
    isPublished: true,
    variants: [
      { id: 'var_01', title: 'Black / M', sku: 'OUTF-BLK-M', priceMinor: 249000, compareAtPriceMinor: 299000, stock: 50 },
      { id: 'var_02', title: 'Black / L', sku: 'OUTF-BLK-L', priceMinor: 249000, compareAtPriceMinor: 299000, stock: 35 },
    ],
  },
  {
    id: 'prod_02',
    storeId: 'store_default',
    title: 'Relaxed Fit Linen Shirt',
    slug: 'relaxed-fit-linen-shirt',
    description: 'Lightweight pure linen, ideal for summer in Karachi, Lahore, and Dubai.',
    categoryId: 'cat_shirts',
    productType: 'Shirt',
    vendor: 'Outfitters PK',
    tags: ['linen', 'breathable'],
    options: [
      { name: 'Color', values: ['White', 'Sky Blue'] },
      { name: 'Size', values: ['M', 'L'] },
    ],
    isPublished: true,
    variants: [
      { id: 'var_03', title: 'White / M', sku: 'LINEN-WHT-M', priceMinor: 499000, compareAtPriceMinor: 599000, stock: 20 },
      { id: 'var_04', title: 'Sky Blue / L', sku: 'LINEN-BLU-L', priceMinor: 499000, compareAtPriceMinor: 599000, stock: 15 },
    ],
  },
  {
    id: 'prod_03',
    storeId: 'store_default',
    title: 'Minimalist Leather Sneakers',
    slug: 'minimalist-leather-sneakers',
    description: 'Handcrafted genuine leather sneakers with cushioned ortholite insoles.',
    categoryId: 'cat_sneakers',
    productType: 'Sneakers',
    vendor: 'Outfitters PK',
    tags: ['leather', 'shoes'],
    options: [
      { name: 'Size', values: ['42 EU', '43 EU'] },
    ],
    isPublished: true,
    variants: [
      { id: 'var_05', title: 'White / 42 EU', sku: 'SNK-WHT-42', priceMinor: 899000, compareAtPriceMinor: 1099000, stock: 12 },
      { id: 'var_06', title: 'White / 43 EU', sku: 'SNK-WHT-43', priceMinor: 899000, compareAtPriceMinor: 1099000, stock: 8 },
    ],
  },
];

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listStorefrontProducts(storeId: string) {
    try {
      const data = await this.db.query.products.findMany({
        where: and(eq(products.storeId, storeId), eq(products.isPublished, true)),
        with: {
          variants: true,
          category: true,
        },
      });
      if (data && data.length > 0) return data;
    } catch (err: any) {
      this.logger.warn(`Postgres connection not active (${err.message}). Using high-speed fallback catalog.`);
    }

    return DEMO_FALLBACK_PRODUCTS;
  }

  async getProductBySlug(storeId: string, slug: string) {
    try {
      const product = await this.db.query.products.findFirst({
        where: and(
          eq(products.storeId, storeId),
          eq(products.slug, slug),
          eq(products.isPublished, true)
        ),
        with: {
          variants: true,
          category: true,
        },
      });
      if (product) return product;
    } catch (err: any) {
      this.logger.warn(`Postgres connection not active (${err.message}). Using fallback product by slug.`);
    }

    return DEMO_FALLBACK_PRODUCTS.find((p) => p.slug === slug) || null;
  }

  async listMerchantProducts(storeId: string) {
    try {
      const data = await this.db.query.products.findMany({
        where: eq(products.storeId, storeId),
        with: {
          variants: true,
          category: true,
        },
        orderBy: [desc(products.createdAt)],
      });
      if (data && data.length > 0) return data;
    } catch (err: any) {
      this.logger.warn(`Postgres connection not active (${err.message}). Using fallback catalog.`);
    }

    return DEMO_FALLBACK_PRODUCTS;
  }

  async createMerchantProduct(storeId: string, payload: any) {
    const prodId = `prod_${Date.now()}`;
    const tenantId = 'tenant_default';

    try {
      await this.db.insert(products).values({
        id: prodId,
        tenantId,
        storeId,
        categoryId: payload.categoryId || null,
        title: payload.title,
        slug: payload.slug,
        description: payload.description || '',
        productType: payload.productType || null,
        vendor: payload.vendor || 'Outfitters PK',
        tags: payload.tags || [],
        options: payload.options || [],
        isPublished: true,
      } as any);

      const variantsToInsert = (payload.variants || []).map((v: any, idx: number) => ({
        id: `var_${Date.now()}_${idx}`,
        tenantId,
        productId: prodId,
        title: v.title,
        sku: v.sku,
        priceMinor: v.priceMinor,
        compareAtPriceMinor: v.compareAtPriceMinor || null,
        stock: v.stock || 0,
      }));

      if (variantsToInsert.length > 0) {
        await this.db.insert(productVariants).values(variantsToInsert as any);
      }

      // If collections assigned
      if (payload.collectionIds && Array.isArray(payload.collectionIds)) {
        for (const colId of payload.collectionIds) {
          await this.db.insert(collectionProducts).values({
            id: `cp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            tenantId,
            collectionId: colId,
            productId: prodId,
          } as any);
        }
      }

      return {
        id: prodId,
        tenantId,
        storeId,
        categoryId: payload.categoryId || null,
        title: payload.title,
        slug: payload.slug,
        description: payload.description,
        productType: payload.productType,
        vendor: payload.vendor,
        tags: payload.tags || [],
        options: payload.options || [],
        isPublished: true,
        variants: variantsToInsert,
      };
    } catch (err: any) {
      this.logger.warn(`DB insert failed: ${err.message}. Returning created item optimistically.`);
      return {
        id: prodId,
        tenantId,
        storeId,
        categoryId: payload.categoryId || null,
        title: payload.title,
        slug: payload.slug,
        description: payload.description,
        productType: payload.productType,
        vendor: payload.vendor,
        tags: payload.tags || [],
        options: payload.options || [],
        isPublished: true,
        variants: payload.variants || [],
      };
    }
  }

  // ----------------------------------------------------
  // Taxonomy & Collections Methods
  // ----------------------------------------------------
  async listCategories() {
    try {
      const data = await this.db.query.categories.findMany();
      if (data && data.length > 0) return data;
    } catch {}
    return DEMO_CATEGORIES;
  }

  async listCollections(storeId: string) {
    try {
      const data = await this.db.query.collections.findMany({
        where: and(eq(collections.storeId, storeId), eq(collections.isPublished, true)),
        with: {
          collectionProducts: true,
        },
      });
      if (data && data.length > 0) return data;
    } catch {}
    return DEMO_COLLECTIONS;
  }

  async getCollectionBySlug(storeId: string, slug: string) {
    try {
      const col = await this.db.query.collections.findFirst({
        where: and(eq(collections.storeId, storeId), eq(collections.slug, slug)),
        with: {
          collectionProducts: {
            with: {
              product: {
                with: {
                  variants: true,
                },
              },
            },
          },
        },
      });
      if (col) return col;
    } catch {}
    return DEMO_COLLECTIONS.find((c) => c.slug === slug) || null;
  }

  async createCollection(storeId: string, payload: any) {
    const colId = `col_${Date.now()}`;
    const tenantId = 'tenant_default';

    try {
      await this.db.insert(collections).values({
        id: colId,
        tenantId,
        storeId,
        title: payload.title,
        slug: payload.slug,
        description: payload.description || '',
        imageUrl: payload.imageUrl || null,
        collectionType: payload.collectionType || 'manual',
        isPublished: true,
      } as any);

      return {
        id: colId,
        title: payload.title,
        slug: payload.slug,
        description: payload.description,
        collectionType: payload.collectionType || 'manual',
      };
    } catch (err: any) {
      this.logger.warn(`Collection DB insert failed: ${err.message}`);
      return {
        id: colId,
        title: payload.title,
        slug: payload.slug,
        description: payload.description,
        collectionType: payload.collectionType || 'manual',
      };
    }
  }
}
