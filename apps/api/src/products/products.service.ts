import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { resolveTenantId } from '../db/store-context';
import {
  type Database,
  products,
  productVariants,
  collections,
  collectionProducts,
  eq,
  and,
  desc,
  inArray,
} from '@repo/db';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${field} is required`);
  }
  return value.trim();
}

function requireSlug(value: unknown): string {
  const slug = requireText(value, 'slug').toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new BadRequestException('slug may only contain lowercase letters, numbers and single hyphens');
  }
  return slug;
}

function requireNonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new BadRequestException(`${field} must be a whole number of 0 or more`);
  }
  return value;
}

@Injectable()
export class ProductsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  }

  async listStorefrontProducts(storeId: string) {
    return this.db.query.products.findMany({
      where: and(eq(products.storeId, storeId), eq(products.isPublished, true)),
      with: {
        variants: true,
        category: true,
      },
      orderBy: [desc(products.createdAt)],
    });
  }

  async getProductBySlug(storeId: string, slug: string) {
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
    return product ?? null;
  }

  async listMerchantProducts(storeId: string) {
    return this.db.query.products.findMany({
      where: eq(products.storeId, storeId),
      with: {
        variants: true,
        category: true,
      },
      orderBy: [desc(products.createdAt)],
    });
  }

  async createMerchantProduct(storeId: string, payload: any) {
    const title = requireText(payload?.title, 'title');
    const slug = requireSlug(payload?.slug);
    const rawVariants: any[] = Array.isArray(payload?.variants) ? payload.variants : [];
    if (rawVariants.length === 0) {
      throw new BadRequestException('At least one variant is required');
    }

    const tenantId = await resolveTenantId(this.db, storeId);

    const existing = await this.db.query.products.findFirst({
      where: and(eq(products.storeId, storeId), eq(products.slug, slug)),
      columns: { id: true },
    });
    if (existing) {
      throw new ConflictException(`A product with slug '${slug}' already exists in this store`);
    }

    const prodId = this.generateId('prod');
    const variantsToInsert = rawVariants.map((v, idx) => ({
      id: this.generateId(`var${idx}`),
      tenantId,
      productId: prodId,
      title: requireText(v?.title, `variants[${idx}].title`),
      sku: requireText(v?.sku, `variants[${idx}].sku`),
      priceMinor: requireNonNegativeInt(v?.priceMinor, `variants[${idx}].priceMinor`),
      compareAtPriceMinor:
        v?.compareAtPriceMinor == null
          ? null
          : requireNonNegativeInt(v.compareAtPriceMinor, `variants[${idx}].compareAtPriceMinor`),
      stock: requireNonNegativeInt(v?.stock ?? 0, `variants[${idx}].stock`),
    }));

    const collectionIds: string[] = Array.isArray(payload?.collectionIds) ? payload.collectionIds : [];
    if (collectionIds.length > 0) {
      const owned = await this.db.query.collections.findMany({
        where: and(eq(collections.storeId, storeId), inArray(collections.id, collectionIds)),
        columns: { id: true },
      });
      if (owned.length !== new Set(collectionIds).size) {
        throw new BadRequestException('One or more collections do not belong to this store');
      }
    }

    await this.db.transaction(async (tx) => {
      await tx.insert(products).values({
        id: prodId,
        tenantId,
        storeId,
        categoryId: payload.categoryId || null,
        title,
        slug,
        description: payload.description || '',
        productType: payload.productType || null,
        vendor: payload.vendor || null,
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        options: Array.isArray(payload.options) ? payload.options : [],
        isPublished: payload.isPublished !== false,
      });

      await tx.insert(productVariants).values(variantsToInsert);

      if (collectionIds.length > 0) {
        await tx.insert(collectionProducts).values(
          collectionIds.map((collectionId) => ({
            id: this.generateId('cp'),
            tenantId,
            collectionId,
            productId: prodId,
          }))
        );
      }
    });

    return this.db.query.products.findFirst({
      where: eq(products.id, prodId),
      with: { variants: true, category: true },
    });
  }

  // ----------------------------------------------------
  // Taxonomy & Collections Methods
  // ----------------------------------------------------
  async listCategories() {
    return this.db.query.categories.findMany();
  }

  async listCollections(storeId: string) {
    return this.db.query.collections.findMany({
      where: and(eq(collections.storeId, storeId), eq(collections.isPublished, true)),
      with: {
        collectionProducts: true,
      },
    });
  }

  async getCollectionBySlug(storeId: string, slug: string) {
    const col = await this.db.query.collections.findFirst({
      where: and(
        eq(collections.storeId, storeId),
        eq(collections.slug, slug),
        eq(collections.isPublished, true)
      ),
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
    if (!col) return null;

    // Never surface unpublished products through a collection.
    return {
      ...col,
      collectionProducts: col.collectionProducts.filter((cp) => cp.product?.isPublished),
    };
  }

  async createCollection(storeId: string, payload: any) {
    const title = requireText(payload?.title, 'title');
    const slug = requireSlug(payload?.slug);
    const tenantId = await resolveTenantId(this.db, storeId);

    const existing = await this.db.query.collections.findFirst({
      where: and(eq(collections.storeId, storeId), eq(collections.slug, slug)),
      columns: { id: true },
    });
    if (existing) {
      throw new ConflictException(`A collection with slug '${slug}' already exists in this store`);
    }

    const colId = this.generateId('col');
    const [created] = await this.db
      .insert(collections)
      .values({
        id: colId,
        tenantId,
        storeId,
        title,
        slug,
        description: payload.description || '',
        imageUrl: payload.imageUrl || null,
        collectionType: payload.collectionType === 'smart' ? 'smart' : 'manual',
        isPublished: true,
      })
      .returning();

    return created;
  }
}
