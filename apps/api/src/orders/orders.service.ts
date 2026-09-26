import { Inject, Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { DRIZZLE } from '../db/db.module';
import { hashSecret, newSecret } from '../auth/session-token';
import { resolveTenantId, type DbExecutor } from '../db/store-context';
import { type Database, orders, orderItems, cartItems, productVariants, eq, and, desc, sql } from '@repo/db';
import { CartService } from '../cart/cart.service';
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

// TODO(phase 3): replace with a DB-generated per-store sequence; this resets on restart.
let ORDER_COUNTER = 1001;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly cartService: CartService,
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

    // 1. Fetch authoritative cart
    const cart = await this.cartService.getCart(cartId);
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cannot checkout with an empty cart');
    }
    if (cart.storeId !== storeId) {
      throw new BadRequestException('Cart does not belong to this store');
    }

    const tenantId = await resolveTenantId(this.db, storeId);
    const subtotalMinor = cart.subtotalMinor;
    const shippingFeeMinor = 0; // Free delivery across Pakistan

    // 2. Validate the promo code. An invalid code rejects checkout instead of silently
    // charging the customer more than the total they were shown.
    let discountCode: string | null = null;
    let discountMinor = 0;
    if (dto.discountCode) {
      const discResult = await this.discountsService.validateDiscount(dto.discountCode, subtotalMinor, storeId);
      discountCode = discResult.code;
      discountMinor = discResult.discountAmountMinor;
    }

    const totalMinor = Math.max(0, subtotalMinor - discountMinor + shippingFeeMinor);
    const paymentMethod = dto.paymentMethod || 'cod';
    const orderId = this.generateId('ord');
    const orderNumber = `PF-${ORDER_COUNTER++}`;
    const accessToken = newSecret(24);

    // 3. Persist order, snapshots, stock and cart clear atomically.
    await this.db.transaction(async (tx) => {
      await tx.insert(orders).values({
        id: orderId,
        tenantId,
        storeId,
        orderNumber,
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
        cart.items.map((item) => ({
          id: this.generateId('oi'),
          tenantId,
          orderId,
          variantId: item.variantId,
          productId: item.productId,
          title: item.title,
          variantTitle: item.variantTitle,
          sku: item.sku,
          unitPriceMinor: item.priceMinor,
          quantity: item.quantity,
          totalMinor: item.totalMinor,
        }))
      );

      // TODO(phase 3): lock variants in sorted order and reject when stock is insufficient.
      await this.adjustStock(tx, cart.items, 'deduct');

      if (discountCode) {
        await this.discountsService.incrementUsage(discountCode, storeId, tx);
      }

      await tx.delete(cartItems).where(eq(cartItems.cartId, cartId));
    });

    this.logger.log(`Order ${orderNumber} (${orderId}) created`);

    // 4. CRM attribution runs after commit so a failed order never inflates customer stats.
    try {
      const customerId = await this.customersService.syncCustomerFromOrder(
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
      if (customerId) {
        await this.db.update(orders).set({ customerId }).where(eq(orders.id, orderId));
      }
    } catch (err: any) {
      this.logger.warn(`Customer sync failed for order ${orderNumber}: ${err.message}`);
    }

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
      const current = await tx.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.storeId, storeId)),
        with: { items: true },
      });
      if (!current) {
        throw new NotFoundException(`Order with id '${orderId}' not found`);
      }

      await tx.update(orders).set({ ...patch, updatedAt: new Date() }).where(eq(orders.id, orderId));

      // Stock moves only on a real transition, so repeated cancels can't restock twice.
      const wasCancelled = current.orderStatus === 'cancelled';
      const isCancelled = (patch.orderStatus ?? current.orderStatus) === 'cancelled';
      if (!wasCancelled && isCancelled) {
        await this.adjustStock(tx, current.items, 'restock');
      } else if (wasCancelled && !isCancelled) {
        await this.adjustStock(tx, current.items, 'deduct');
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
      .where(eq(orders.id, orderId));

    return this.getStoreOrder(storeId, orderId);
  }

  private async adjustStock(
    executor: DbExecutor,
    items: Array<{ variantId: string | null; quantity: number }>,
    direction: 'deduct' | 'restock'
  ) {
    for (const item of items) {
      if (!item.variantId) continue;
      const stock =
        direction === 'deduct'
          ? sql`GREATEST(0, ${productVariants.stock} - ${item.quantity})`
          : sql`${productVariants.stock} + ${item.quantity}`;
      await executor
        .update(productVariants)
        .set({ stock, updatedAt: new Date() })
        .where(eq(productVariants.id, item.variantId));
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
