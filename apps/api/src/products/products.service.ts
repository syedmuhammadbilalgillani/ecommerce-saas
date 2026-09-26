import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
  ne,
  gte,
  desc,
  inArray,
  sql,
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

  /** Edits product details. Publishing/unpublishing is how products are retired (orders keep their snapshots). */
  async updateMerchantProduct(storeId: string, productId: string, payload: any) {
    const product = await this.requireStoreProduct(storeId, productId);
    const patch: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };

    if (payload?.title !== undefined) patch.title = requireText(payload.title, 'title');
    if (payload?.slug !== undefined) {
      const slug = requireSlug(payload.slug);
      if (slug !== product.slug) {
        const taken = await this.db.query.products.findFirst({
          where: and(eq(products.storeId, storeId), eq(products.slug, slug), ne(products.id, productId)),
          columns: { id: true },
        });
        if (taken) throw new ConflictException(`A product with slug '${slug}' already exists in this store`);
      }
      patch.slug = slug;
    }
    if (payload?.description !== undefined) patch.description = String(payload.description ?? '');
    if (payload?.productType !== undefined) patch.productType = payload.productType ? String(payload.productType) : null;
    if (payload?.vendor !== undefined) patch.vendor = payload.vendor ? String(payload.vendor) : null;
    if (payload?.categoryId !== undefined) patch.categoryId = payload.categoryId || null;
    if (payload?.tags !== undefined) {
      if (!Array.isArray(payload.tags)) throw new BadRequestException('tags must be a list');
      patch.tags = payload.tags.map((t: unknown) => String(t).trim()).filter(Boolean);
    }
    if (payload?.isPublished !== undefined) {
      if (typeof payload.isPublished !== 'boolean') throw new BadRequestException('isPublished must be true or false');
      patch.isPublished = payload.isPublished;
    }

    await this.db.update(products).set(patch).where(eq(products.id, productId));
    return this.getMerchantProduct(storeId, productId);
  }

  /** Edits a variant's title, SKU and prices. Stock is changed only via adjustVariantStock. */
  async updateMerchantVariant(storeId: string, productId: string, variantId: string, payload: any) {
    await this.requireStoreProduct(storeId, productId);
    const patch: Partial<typeof productVariants.$inferInsert> = { updatedAt: new Date() };

    if (payload?.title !== undefined) patch.title = requireText(payload.title, 'title');
    if (payload?.sku !== undefined) patch.sku = requireText(payload.sku, 'sku');
    if (payload?.priceMinor !== undefined) patch.priceMinor = requireNonNegativeInt(payload.priceMinor, 'priceMinor');
    if (payload?.compareAtPriceMinor !== undefined) {
      patch.compareAtPriceMinor =
        payload.compareAtPriceMinor === null ? null : requireNonNegativeInt(payload.compareAtPriceMinor, 'compareAtPriceMinor');
    }

    const updated = await this.db
      .update(productVariants)
      .set(patch)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
      .returning({ id: productVariants.id });
    if (updated.length === 0) throw new NotFoundException('Variant not found');

    return this.getMerchantProduct(storeId, productId);
  }

  /**
   * Adds or removes stock by a delta (e.g. +20 received, -2 damaged) in one atomic UPDATE.
   * A delta, not "set to N", so a sale happening at the same moment is never overwritten.
   */
  async adjustVariantStock(storeId: string, productId: string, variantId: string, rawDelta: unknown) {
    await this.requireStoreProduct(storeId, productId);
    if (typeof rawDelta !== 'number' || !Number.isInteger(rawDelta) || rawDelta === 0 || Math.abs(rawDelta) > 100000) {
      throw new BadRequestException('delta must be a non-zero whole number (e.g. 10 or -3)');
    }

    const updated = await this.db
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${rawDelta}`, updatedAt: new Date() })
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(productVariants.productId, productId),
          gte(sql`${productVariants.stock} + ${rawDelta}`, 0)
        )
      )
      .returning({ id: productVariants.id });

    if (updated.length === 0) {
      const variant = await this.db.query.productVariants.findFirst({
        where: and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)),
        columns: { stock: true },
      });
      if (!variant) throw new NotFoundException('Variant not found');
      throw new ConflictException(`Cannot remove ${-rawDelta}: only ${variant.stock} in stock`);
    }

    return this.getMerchantProduct(storeId, productId);
  }

  private async getMerchantProduct(storeId: string, productId: string) {
    const product = await this.db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.storeId, storeId)),
      with: { variants: true, category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async requireStoreProduct(storeId: string, productId: string) {
    const product = await this.db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.storeId, storeId)),
      columns: { id: true, slug: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
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
