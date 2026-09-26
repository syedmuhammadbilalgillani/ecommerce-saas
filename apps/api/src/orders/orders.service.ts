import { Inject, Injectable, Logger, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { DRIZZLE } from '../db/db.module';
import { hashSecret, newSecret } from '../auth/session-token';
import type { DbExecutor } from '../db/store-context';
import {
  type Database,
  orders,
  orderItems,
  carts,
  cartItems,
  products,
  productVariants,
  stores,
  eq,
  and,
  asc,
  desc,
  inArray,
  isNull,
  sql,
} from '@repo/db';
import { DiscountsService } from '../discounts/discounts.service';
import { CustomersService } from '../customers/customers.service';

export interface CheckoutDto {
  cartId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string;
  shippingCity: string;
  shippingProvince?: string;
  shippingPostalCode?: string;
  paymentMethod?: string; // default: 'cod'
  discountCode?: string;
  notes?: string;
}

export interface FormattedOrderItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  title: string;
  variantTitle: string;
  sku: string;
  unitPriceMinor: number;
  quantity: number;
  totalMinor: number;
}

export interface FormattedOrder {
  id: string;
  orderNumber: string;
  storeId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  shippingAddressLine1: string;
  shippingAddressLine2?: string | null;
  shippingCity: string;
  shippingProvince?: string | null;
  shippingPostalCode?: string | null;
  paymentMethod: string;
  financialStatus: string;
  fulfillmentStatus: string;
  orderStatus: string;
  courierName?: string | null;
  courierTrackingNumber?: string | null;
  courierStatus?: string | null;
  discountCode?: string | null;
  discountMinor?: number;
  currency: string;
  subtotalMinor: number;
  shippingFeeMinor: number;
  totalMinor: number;
  notes?: string | null;
  createdAt: string;
  items: FormattedOrderItem[];
}

export interface OrderStatusUpdate {
  financialStatus?: string;
  fulfillmentStatus?: string;
  orderStatus?: string;
}

const ALLOWED_STATUS_VALUES: Record<keyof OrderStatusUpdate, readonly string[]> = {
  financialStatus: ['pending', 'paid', 'refunded', 'voided'],
  fulfillmentStatus: ['unfulfilled', 'pending', 'in_transit', 'delivered', 'fulfilled', 'returned', 'cancelled'],
  orderStatus: ['open', 'closed', 'cancelled'],
};

export interface OutOfStockLine {
  variantId: string;
  title: string;
  requested: number;
  available: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly discountsService: DiscountsService,
    private readonly customersService: CustomersService,
  ) {}

  private generateId(prefix: string): string {
    return `${prefix}_${randomBytes(12).toString('hex')}`;
  }

  async checkout(
    dto: CheckoutDto,
    headerCartId: string | undefined,
    storeId: string
  ): Promise<{ order: FormattedOrder; accessToken: string }> {
    const cartId = dto.cartId || headerCartId;
    if (!cartId) {
      throw new BadRequestException('A valid cartId is required for checkout');
    }

    if (!dto.customerName?.trim() || !dto.customerPhone?.trim() || !dto.shippingAddressLine1?.trim() || !dto.shippingCity?.trim()) {
      throw new BadRequestException('Missing required fields: Name, Phone, Address, and City are required');
    }

    const paymentMethod = dto.paymentMethod || 'cod';
    const orderId = this.generateId('ord');
    const accessToken = newSecret(24);
    const shippingFeeMinor = 0; // Free delivery across Pakistan

    // Everything below is one transaction. Locks are always taken in the same order
    // (cart -> variants sorted by id -> discount -> customer -> store counter) so concurrent
    // checkouts queue up instead of deadlocking, and nothing is half-written on failure.
    const orderNumber = await this.db.transaction(async (tx) => {
      // 1. Lock the cart: a double-submitted checkout waits here, then finds the cart empty.
      const [cart] = await tx.select().from(carts).where(eq(carts.id, cartId)).for('update');
      if (!cart || cart.storeId !== storeId) {
        throw new BadRequestException('Cart not found for this store');
      }
      const lines = await tx.select().from(cartItems).where(eq(cartItems.cartId, cartId));
      if (lines.length === 0) {
        throw new BadRequestException('Cannot checkout with an empty cart');
      }

      // 2. Lock every variant being bought (sorted by id) and read authoritative price + stock.
      const qtyByVariant = new Map<string, number>();
      for (const line of lines) {
        qtyByVariant.set(line.variantId, (qtyByVariant.get(line.variantId) ?? 0) + line.quantity);
      }
      const variantIds = [...qtyByVariant.keys()].sort();
      const locked = await tx
        .select({ variant: productVariants, product: products })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, variantIds))
        .orderBy(asc(productVariants.id))
        .for('update', { of: productVariants });
      const byId = new Map(locked.map((row) => [row.variant.id, row]));

      const outOfStock: OutOfStockLine[] = [];
      for (const [variantId, requested] of qtyByVariant) {
        const row = byId.get(variantId);
        if (!row || row.product.storeId !== storeId || !row.product.isPublished) {
          outOfStock.push({ variantId, title: row?.product.title ?? 'Unavailable item', requested, available: 0 });
        } else if (row.variant.stock < requested) {
          outOfStock.push({
            variantId,
            title: `${row.product.title} (${row.variant.title})`,
            requested,
            available: row.variant.stock,
          });
        }
      }
      if (outOfStock.length > 0) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: `Not enough stock: ${outOfStock.map((l) => `${l.title} — ${l.available} left`).join('; ')}`,
          outOfStock,
        });
      }

      const snapshot = variantIds.map((variantId) => {
        const { variant, product } = byId.get(variantId)!;
        const quantity = qtyByVariant.get(variantId)!;
        return {
          variantId,
          productId: product.id,
          title: product.title,
          variantTitle: variant.title,
          sku: variant.sku,
          unitPriceMinor: variant.priceMinor,
          quantity,
          totalMinor: variant.priceMinor * quantity,
        };
      });
      const subtotalMinor = snapshot.reduce((sum, line) => sum + line.totalMinor, 0);

      // 3. Redeem the promo code atomically (usage limit can't be exceeded under concurrency).
      // An invalid code rejects checkout rather than silently charging more than was shown.
      let discountCode: string | null = null;
      let discountMinor = 0;
      if (dto.discountCode) {
        const redeemed = await this.discountsService.redeem(tx, dto.discountCode, storeId, subtotalMinor);
        discountCode = redeemed.code;
        discountMinor = redeemed.discountAmountMinor;
      }
      const totalMinor = Math.max(0, subtotalMinor - discountMinor + shippingFeeMinor);

      // 4. Take the next per-store order number (this row lock serializes numbering only).
      const [store] = await tx
        .update(stores)
        .set({ nextOrderNumber: sql`${stores.nextOrderNumber} + 1` })
        .where(eq(stores.id, storeId))
        .returning({ tenantId: stores.tenantId, taken: sql<number>`${stores.nextOrderNumber} - 1` });
      const number = `PF-${store.taken}`;
      const tenantId = store.tenantId;

      // 5. CRM attribution in the same transaction, so stats always match committed orders.
      const customerId = await this.customersService.syncCustomerFromOrder(
        tx,
        {
          name: dto.customerName,
          phone: dto.customerPhone,
          email: dto.customerEmail,
          address: { address1: dto.shippingAddressLine1, city: dto.shippingCity, province: dto.shippingProvince },
          orderTotalMinor: totalMinor,
        },
        storeId,
        tenantId
      );

      // 6. Persist the order with immutable line snapshots.
      await tx.insert(orders).values({
        id: orderId,
        tenantId,
        storeId,
        orderNumber: number,
        customerId,
        discountCode,
        discountMinor,
        customerName: dto.customerName.trim(),
        customerPhone: dto.customerPhone.trim(),
        customerEmail: dto.customerEmail?.trim() || null,
        shippingAddressLine1: dto.shippingAddressLine1.trim(),
        shippingAddressLine2: dto.shippingAddressLine2?.trim() || null,
        shippingCity: dto.shippingCity.trim(),
        shippingProvince: dto.shippingProvince?.trim() || 'Pakistan',
        shippingPostalCode: dto.shippingPostalCode || null,
        paymentMethod,
        financialStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
        fulfillmentStatus: 'unfulfilled',
        orderStatus: 'open',
        currency: cart.currency,
        subtotalMinor,
        shippingFeeMinor,
        totalMinor,
        notes: dto.notes || null,
        accessToken: hashSecret(accessToken),
      });

      await tx.insert(orderItems).values(
        snapshot.map((line) => ({ id: this.generateId('oi'), tenantId, orderId, ...line }))
      );

      // 7. Deduct stock exactly (already verified under lock; the DB CHECK is a last line of defence).
      for (const line of snapshot) {
        await tx
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} - ${line.quantity}`, updatedAt: new Date() })
          .where(eq(productVariants.id, line.variantId));
      }

      await tx.delete(cartItems).where(eq(cartItems.cartId, cartId));
      return number;
    });

    this.logger.log(`Order ${orderNumber} (${orderId}) created`);

    return { order: await this.getStoreOrder(storeId, orderId), accessToken };
  }

  /** Merchant-side lookup: the order must belong to the caller's store. */
  async getStoreOrder(storeId: string, orderId: string): Promise<FormattedOrder> {
    const order = await this.db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.storeId, storeId)),
      with: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with id '${orderId}' not found`);
    }
    return this.formatOrder(order);
  }

  /** Shopper-side lookup: requires the secret token issued at checkout. */
  async getStorefrontOrder(storeId: string, orderId: string, token: string | undefined): Promise<FormattedOrder> {
    const order = await this.db.query.orders.findFirst({
      where: and(eq(orders.id, orderId), eq(orders.storeId, storeId)),
      with: { items: true },
    });

    const expected = order?.accessToken ? Buffer.from(order.accessToken) : null;
    const actual = token ? Buffer.from(hashSecret(token)) : null;
    const tokenMatches = !!expected && !!actual && expected.length === actual.length && timingSafeEqual(expected, actual);

    // Same 404 whether the order is missing or the token is wrong, so ids can't be probed.
    if (!order || !tokenMatches) {
      throw new NotFoundException('Order not found');
    }
    return this.formatOrder(order);
  }

  async listAdminOrders(storeId: string): Promise<FormattedOrder[]> {
    const records = await this.db.query.orders.findMany({
      where: eq(orders.storeId, storeId),
      with: { items: true },
      orderBy: [desc(orders.createdAt)],
    });
    return records.map((order) => this.formatOrder(order));
  }

  async updateOrderStatus(storeId: string, orderId: string, update: OrderStatusUpdate): Promise<FormattedOrder> {
    // Only these three columns may be changed through this endpoint, and only to known values.
    const patch: OrderStatusUpdate = {};
    for (const field of Object.keys(ALLOWED_STATUS_VALUES) as Array<keyof OrderStatusUpdate>) {
      const value = update?.[field];
      if (value === undefined) continue;
      if (!ALLOWED_STATUS_VALUES[field].includes(value)) {
        throw new BadRequestException(`Invalid ${field} '${value}'`);
      }
      patch[field] = value;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No status fields supplied');
    }

    await this.db.transaction(async (tx) => {
      // Lock the order row so two concurrent cancels can't both restock.
      const [current] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
        .for('update');
      if (!current) {
        throw new NotFoundException(`Order with id '${orderId}' not found`);
      }
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));

      await tx.update(orders).set({ ...patch, updatedAt: new Date() }).where(eq(orders.id, orderId));

      // Stock moves only on a real transition, so repeated cancels can't restock twice.
      const wasCancelled = current.orderStatus === 'cancelled';
      const isCancelled = (patch.orderStatus ?? current.orderStatus) === 'cancelled';
      if (!wasCancelled && isCancelled) {
        await this.restock(tx, items);
      } else if (wasCancelled && !isCancelled) {
        // Re-opening takes the goods back out of stock — only if they are still there.
        await this.deductWithCheck(tx, items);
      }
    });

    return this.getStoreOrder(storeId, orderId);
  }

  async verifyWhatsApp(storeId: string, orderId: string, verifiedBy: 'customer' | 'merchant'): Promise<FormattedOrder> {
    const order = await this.getStoreOrder(storeId, orderId);
    const tag = `[WhatsApp Verified: ${verifiedBy.toUpperCase()}]`;
    const updatedNotes = order.notes
      ? (order.notes.includes('WhatsApp Verified') ? order.notes : `${order.notes} | ${tag}`)
      : tag;

    await this.db.update(orders)
      .set({ notes: updatedNotes, updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    this.logger.log(`Order ${order.orderNumber} marked WhatsApp verified by ${verifiedBy}`);
    return this.getStoreOrder(storeId, orderId);
  }

  async updateOrderNotes(storeId: string, orderId: string, notes: string): Promise<FormattedOrder> {
    await this.getStoreOrder(storeId, orderId);
    await this.db.update(orders)
      .set({ notes, updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    return this.getStoreOrder(storeId, orderId);
  }

  async bookCourier(storeId: string, orderId: string, courierName: string = 'Trax') {
    const order = await this.getStoreOrder(storeId, orderId);
    if (order.orderStatus === 'cancelled') {
      throw new BadRequestException('Cannot book a courier for a cancelled order');
    }
    if (order.courierTrackingNumber) {
      throw new BadRequestException(`Order already booked with ${order.courierName} (CN: ${order.courierTrackingNumber})`);
    }

    // NOTE: no courier API integration yet — this CN is generated locally, not issued by Trax.
    const prefix = courierName.substring(0, 3).toUpperCase();
    const trackingNumber = `${prefix}-${Math.floor(1000000 + Math.random() * 9000000)}`;

    await this.db.update(orders)
      .set({
        courierName,
        courierTrackingNumber: trackingNumber,
        courierStatus: 'booked',
        fulfillmentStatus: 'in_transit',
        updatedAt: new Date(),
      })
      // Conditional so two simultaneous clicks can't both book.
      .where(and(eq(orders.id, orderId), isNull(orders.courierTrackingNumber)));

    return this.getStoreOrder(storeId, orderId);
  }

  private async restock(executor: DbExecutor, items: Array<{ variantId: string | null; quantity: number }>) {
    for (const item of items) {
      if (!item.variantId) continue;
      await executor
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} + ${item.quantity}`, updatedAt: new Date() })
        .where(eq(productVariants.id, item.variantId));
    }
  }

  /** Locks the variants (sorted by id), verifies stock, then deducts. Throws 409 if short. */
  private async deductWithCheck(executor: DbExecutor, items: Array<{ variantId: string | null; quantity: number; title: string }>) {
    const lines = items.filter((i): i is typeof i & { variantId: string } => !!i.variantId);
    if (lines.length === 0) return;

    const locked = await executor
      .select({ id: productVariants.id, stock: productVariants.stock })
      .from(productVariants)
      .where(inArray(productVariants.id, [...new Set(lines.map((l) => l.variantId))]))
      .orderBy(asc(productVariants.id))
      .for('update');
    const stockById = new Map(locked.map((v) => [v.id, v.stock]));

    const short = lines.filter((l) => (stockById.get(l.variantId) ?? 0) < l.quantity);
    if (short.length > 0) {
      throw new ConflictException(
        `Cannot re-open: not enough stock for ${short.map((l) => `${l.title} (${stockById.get(l.variantId) ?? 0} left)`).join(', ')}`
      );
    }

    for (const line of lines) {
      await executor
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} - ${line.quantity}`, updatedAt: new Date() })
        .where(eq(productVariants.id, line.variantId));
    }
  }

  private formatOrder(order: any): FormattedOrder {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      storeId: order.storeId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      shippingAddressLine1: order.shippingAddressLine1,
      shippingAddressLine2: order.shippingAddressLine2,
      shippingCity: order.shippingCity,
      shippingProvince: order.shippingProvince,
      shippingPostalCode: order.shippingPostalCode,
      paymentMethod: order.paymentMethod,
      financialStatus: order.financialStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      orderStatus: order.orderStatus,
      courierName: order.courierName,
      courierTrackingNumber: order.courierTrackingNumber,
      courierStatus: order.courierStatus,
      discountCode: order.discountCode,
      discountMinor: order.discountMinor,
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      shippingFeeMinor: order.shippingFeeMinor,
      totalMinor: order.totalMinor,
      notes: order.notes,
      createdAt: order.createdAt.toISOString(),
      items: (order.items || []).map((item: any) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        title: item.title,
        variantTitle: item.variantTitle,
        sku: item.sku,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity,
        totalMinor: item.totalMinor,
      })),
    };
  }
}
