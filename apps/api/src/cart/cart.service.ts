import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DRIZZLE } from '../db/db.module';
import { resolveTenantId } from '../db/store-context';
import { type Database, carts, cartItems, productVariants, eq, and, sql } from '@repo/db';

export interface FormattedCartItem {
  id: string;
  variantId: string;
  productId: string;
  title: string;
  variantTitle: string;
  sku: string;
  priceMinor: number;
  quantity: number;
  totalMinor: number;
}

export interface FormattedCart {
  id: string;
  storeId: string;
  currency: string;
  itemCount: number;
  subtotalMinor: number;
  items: FormattedCartItem[];
}

const CART_WITH_ITEMS = {
  items: {
    with: {
      variant: {
        with: {
          product: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class CartService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // Cart ids act as the shopper's bearer credential for their cart, so they must be unguessable.
  private generateId(prefix: string): string {
    return `${prefix}_${randomBytes(16).toString('hex')}`;
  }

  /** Returns the cart, or null if it does not exist. Never creates one. */
  async getCart(cartId: string): Promise<FormattedCart | null> {
    const record = await this.db.query.carts.findFirst({
      where: eq(carts.id, cartId),
      with: CART_WITH_ITEMS,
    });
    return record ? this.formatDbCart(record) : null;
  }

  async getOrCreateCart(cartId: string | undefined, storeId: string): Promise<FormattedCart> {
    if (cartId) {
      const existing = await this.getCart(cartId);
      // A cart from another store is treated as missing; the shopper gets a fresh cart here.
      if (existing && existing.storeId === storeId) return existing;
    }

    // Unknown or missing cart id: always mint a server-generated id rather than trusting the client's.
    const tenantId = await resolveTenantId(this.db, storeId);
    const id = this.generateId('cart');
    await this.db.insert(carts).values({ id, storeId, tenantId, currency: 'PKR' });

    return { id, storeId, currency: 'PKR', itemCount: 0, subtotalMinor: 0, items: [] };
  }

  async addItem(
    cartId: string | undefined,
    variantId: string,
    quantity: number,
    storeId: string
  ): Promise<FormattedCart> {
    const activeCart = await this.getOrCreateCart(cartId, storeId);

    const variant = await this.db.query.productVariants.findFirst({
      where: eq(productVariants.id, variantId),
      with: { product: true },
    });

    if (!variant || variant.product.storeId !== activeCart.storeId || !variant.product.isPublished) {
      throw new NotFoundException(`Variant '${variantId}' is not available in this store`);
    }

    const existingItem = await this.db.query.cartItems.findFirst({
      where: and(eq(cartItems.cartId, activeCart.id), eq(cartItems.variantId, variantId)),
    });

    // Early, friendly check; checkout re-verifies under a row lock, which is the real guarantee.
    this.assertInStock(variant.stock, (existingItem?.quantity ?? 0) + quantity);

    if (existingItem) {
      await this.db
        .update(cartItems)
        .set({ quantity: sql`${cartItems.quantity} + ${quantity}`, updatedAt: new Date() })
        .where(eq(cartItems.id, existingItem.id));
    } else {
      await this.db.insert(cartItems).values({
        id: this.generateId('ci'),
        cartId: activeCart.id,
        variantId,
        quantity,
      });
    }

    return this.requireCart(activeCart.id, storeId);
  }

  async updateItemQuantity(cartId: string, itemId: string, quantity: number, storeId: string): Promise<FormattedCart> {
    if (quantity <= 0) {
      return this.removeItem(cartId, itemId, storeId);
    }
    await this.requireCart(cartId, storeId);
    const line = await this.db.query.cartItems.findFirst({
      where: and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)),
      with: { variant: true },
    });
    if (line) this.assertInStock(line.variant.stock, quantity);

    await this.db
      .update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));

    return this.requireCart(cartId, storeId);
  }

  async removeItem(cartId: string, itemId: string, storeId: string): Promise<FormattedCart> {
    await this.requireCart(cartId, storeId);
    await this.db
      .delete(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));

    return this.requireCart(cartId, storeId);
  }

  private assertInStock(available: number, wanted: number) {
    if (available <= 0) {
      throw new ConflictException('This item is sold out');
    }
    if (wanted > available) {
      throw new ConflictException(`Only ${available} left in stock`);
    }
  }

  private async requireCart(cartId: string, storeId: string): Promise<FormattedCart> {
    const cart = await this.getCart(cartId);
    if (!cart || cart.storeId !== storeId) {
      throw new NotFoundException(`Cart '${cartId}' not found`);
    }
    return cart;
  }

  private formatDbCart(record: any): FormattedCart {
    const rawItems = record.items || [];
    let subtotalMinor = 0;
    let itemCount = 0;

    const items: FormattedCartItem[] = rawItems.map((item: any) => {
      const variant = item.variant;
      const product = variant?.product;
      const priceMinor = variant?.priceMinor || 0;
      const totalMinor = priceMinor * item.quantity;

      subtotalMinor += totalMinor;
      itemCount += item.quantity;

      return {
        id: item.id,
        variantId: item.variantId,
        productId: product?.id || '',
        title: product?.title || 'Unknown Product',
        variantTitle: variant?.title || 'Default',
        sku: variant?.sku || '',
        priceMinor,
        quantity: item.quantity,
        totalMinor,
      };
    });

    return {
      id: record.id,
      storeId: record.storeId,
      currency: record.currency || 'PKR',
      itemCount,
      subtotalMinor,
      items,
    };
  }
}
