import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { type Database, carts, cartItems, productVariants, products, eq, and } from '@repo/db';

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

// In-memory fallback cart state if DB is offline during development
const MEMORY_CARTS = new Map<string, FormattedCart>();

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  }

  async getOrCreateCart(cartId?: string, storeId: string = 'store_default', tenantId: string = 'ten_pilot_01'): Promise<FormattedCart> {
    const id = cartId || this.generateId('cart');

    try {
      let cartRecord = await this.db.query.carts.findFirst({
        where: eq(carts.id, id),
        with: {
          items: {
            with: {
              variant: {
                with: {
                  product: true,
                },
              },
            },
          },
        },
      });

      if (!cartRecord) {
        await this.db.insert(carts).values({
          id,
          storeId,
          tenantId,
          currency: 'PKR',
        } as any).onConflictDoNothing();

        cartRecord = await this.db.query.carts.findFirst({
          where: eq(carts.id, id),
          with: {
            items: {
              with: {
                variant: {
                  with: {
                    product: true,
                  },
                },
              },
            },
          },
        });
      }

      if (cartRecord) {
        return this.formatDbCart(cartRecord);
      }
    } catch (err: any) {
      this.logger.warn(`Postgres cart query failed (${err.message}). Using memory cart fallback.`);
    }

    // Memory Fallback
    if (!MEMORY_CARTS.has(id)) {
      MEMORY_CARTS.set(id, {
        id,
        storeId,
        currency: 'PKR',
        itemCount: 0,
        subtotalMinor: 0,
        items: [],
      });
    }
    return MEMORY_CARTS.get(id)!;
  }

  async addItem(
    cartId: string | undefined,
    variantId: string,
    quantity: number = 1,
    storeId: string = 'store_default',
    tenantId: string = 'ten_pilot_01'
  ): Promise<FormattedCart> {
    const activeCart = await this.getOrCreateCart(cartId, storeId, tenantId);

    try {
      // Find variant in DB to get authoritative price & title
      const variant = await this.db.query.productVariants.findFirst({
        where: eq(productVariants.id, variantId),
        with: { product: true },
      });

      if (variant) {
        // Check if item already in cart
        const existingItem = await this.db.query.cartItems.findFirst({
          where: and(eq(cartItems.cartId, activeCart.id), eq(cartItems.variantId, variantId)),
        });

        if (existingItem) {
          await this.db.update(cartItems)
            .set({ quantity: (existingItem as any).quantity + quantity, updatedAt: new Date() } as any)
            .where(eq(cartItems.id, existingItem.id));
        } else {
          await this.db.insert(cartItems).values({
            id: this.generateId('ci'),
            cartId: activeCart.id,
            variantId,
            quantity,
          } as any);
        }

        return await this.getOrCreateCart(activeCart.id, storeId, tenantId);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to add item to DB cart (${err.message}). Using memory fallback.`);
    }

    // Memory Fallback
    let item = activeCart.items.find((i) => i.variantId === variantId);
    if (item) {
      item.quantity += quantity;
      item.totalMinor = item.quantity * item.priceMinor;
    } else {
      activeCart.items.push({
        id: this.generateId('ci'),
        variantId,
        productId: 'prod_01',
        title: 'Selected Item',
        variantTitle: 'Standard',
        sku: 'SKU-ITEM',
        priceMinor: 249000,
        quantity,
        totalMinor: quantity * 249000,
      });
    }

    this.recalculateMemoryCart(activeCart);
    return activeCart;
  }

  async updateItemQuantity(cartId: string, itemId: string, quantity: number): Promise<FormattedCart> {
    if (quantity <= 0) {
      return this.removeItem(cartId, itemId);
    }

    try {
      await this.db.update(cartItems)
        .set({ quantity, updatedAt: new Date() } as any)
        .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));

      return await this.getOrCreateCart(cartId);
    } catch (err: any) {
      this.logger.warn(`Failed to update item in DB cart (${err.message}). Falling back to memory.`);
    }

    const memoryCart = await this.getOrCreateCart(cartId);
    const item = memoryCart.items.find((i) => i.id === itemId);
    if (item) {
      item.quantity = quantity;
      item.totalMinor = item.quantity * item.priceMinor;
      this.recalculateMemoryCart(memoryCart);
    }
    return memoryCart;
  }

  async removeItem(cartId: string, itemId: string): Promise<FormattedCart> {
    try {
      await this.db.delete(cartItems)
        .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));

      return await this.getOrCreateCart(cartId);
    } catch (err: any) {
      this.logger.warn(`Failed to delete item from DB cart (${err.message}). Falling back to memory.`);
    }

    const memoryCart = await this.getOrCreateCart(cartId);
    memoryCart.items = memoryCart.items.filter((i) => i.id !== itemId);
    this.recalculateMemoryCart(memoryCart);
    return memoryCart;
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

  private recalculateMemoryCart(cart: FormattedCart) {
    cart.subtotalMinor = cart.items.reduce((sum, item) => sum + item.totalMinor, 0);
    cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }
}
