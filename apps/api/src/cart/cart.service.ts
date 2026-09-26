import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  }

  /** Returns the cart, or null if it does not exist. Never creates one. */
  async getCart(cartId: string): Promise<FormattedCart | null> {
    const record = await this.db.query.carts.findFirst({
      where: eq(carts.id, cartId),
      with: CART_WITH_ITEMS,
    });
    return record ? this.formatDbCart(record) : null;
  }

  async getOrCreateCart(cartId?: string, storeId: string = 'store_default'): Promise<FormattedCart> {
    if (cartId) {
      const existing = await this.getCart(cartId);
      if (existing) return existing;
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
    storeId: string = 'store_default'
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

    return this.requireCart(activeCart.id);
  }

  async updateItemQuantity(cartId: string, itemId: string, quantity: number): Promise<FormattedCart> {
    if (quantity <= 0) {
      return this.removeItem(cartId, itemId);
    }

    await this.db
      .update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));

    return this.requireCart(cartId);
  }

  async removeItem(cartId: string, itemId: string): Promise<FormattedCart> {
    await this.db
      .delete(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));

    return this.requireCart(cartId);
  }

  private async requireCart(cartId: string): Promise<FormattedCart> {
    const cart = await this.getCart(cartId);
    if (!cart) {
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
