import { Inject, Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { type Database, orders, orderItems, carts, cartItems, productVariants, eq, and, sql } from '@repo/db';
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

const MEMORY_ORDERS = new Map<string, FormattedOrder>();
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
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  }

  async checkout(
    dto: CheckoutDto,
    headerCartId?: string,
    storeId: string = 'store_default',
    tenantId: string = 'ten_pilot_01'
  ): Promise<FormattedOrder> {
    const cartId = dto.cartId || headerCartId;
    if (!cartId) {
      throw new BadRequestException('A valid cartId is required for checkout');
    }

    if (!dto.customerName || !dto.customerPhone || !dto.shippingAddressLine1 || !dto.shippingCity) {
      throw new BadRequestException('Missing required fields: Name, Phone, Address, and City are required');
    }

    // 1. Fetch authoritative cart
    const cart = await this.cartService.getOrCreateCart(cartId, storeId, tenantId);
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cannot checkout with an empty cart');
    }

    const orderId = this.generateId('ord');
    const orderNumber = `PF-${ORDER_COUNTER++}`;
    const subtotalMinor = cart.subtotalMinor;
    let shippingFeeMinor = 0; // Free delivery across Pakistan
    let discountCode: string | null = null;
    let discountMinor = 0;

    // 2. Validate and apply discount promo code if supplied
    if (dto.discountCode) {
      try {
        const discResult = await this.discountsService.validateDiscount(
          dto.discountCode,
          subtotalMinor,
          storeId,
          tenantId
        );
        if (discResult.valid) {
          discountCode = discResult.code;
          discountMinor = discResult.discountAmountMinor;
          if (discResult.freeShipping) {
            shippingFeeMinor = 0;
          }
          await this.discountsService.incrementUsage(discResult.code);
        }
      } catch (err: any) {
        this.logger.warn(`Discount validation skipped: ${err.message}`);
      }
    }

    const totalMinor = Math.max(0, subtotalMinor - discountMinor + shippingFeeMinor);
    const paymentMethod = dto.paymentMethod || 'cod';

    // 3. Shopify-style Customer CRM Attribution
    let customerId: string | null = null;
    try {
      customerId = await this.customersService.syncCustomerFromOrder(
        {
          name: dto.customerName,
          phone: dto.customerPhone,
          email: dto.customerEmail,
          address: {
            address1: dto.shippingAddressLine1,
            city: dto.shippingCity,
            province: dto.shippingProvince,
          },
          orderTotalMinor: totalMinor,
        },
        storeId,
        tenantId
      );
    } catch (err: any) {
      this.logger.warn(`Customer sync warning: ${err.message}`);
    }

    try {
      // 4. Persist Order in Postgres
      await this.db.insert(orders).values({
        id: orderId,
        tenantId,
        storeId,
        orderNumber,
        customerId,
        discountCode,
        discountMinor,
        customerName: dto.customerName.trim(),
        customerPhone: dto.customerPhone.trim(),
        customerEmail: dto.customerEmail ? dto.customerEmail.trim() : null,
        shippingAddressLine1: dto.shippingAddressLine1.trim(),
        shippingAddressLine2: dto.shippingAddressLine2 ? dto.shippingAddressLine2.trim() : null,
        shippingCity: dto.shippingCity.trim(),
        shippingProvince: dto.shippingProvince ? dto.shippingProvince.trim() : 'Pakistan',
        shippingPostalCode: dto.shippingPostalCode || null,
        paymentMethod,
        financialStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
        fulfillmentStatus: 'unfulfilled',
        orderStatus: 'open',
        currency: 'PKR',
        subtotalMinor,
        shippingFeeMinor,
        totalMinor,
        notes: dto.notes || null,
      } as any);

      // 3. Persist Immutable Order Items Snapshots
      const itemsToInsert = cart.items.map((item) => ({
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
      }));

      for (const itemRecord of itemsToInsert) {
        await this.db.insert(orderItems).values(itemRecord as any);
      }

      // 4. Atomic Inventory Stock Deduction
      for (const item of cart.items) {
        if (item.variantId) {
          try {
            await this.db
              .update(productVariants)
              .set({
                stock: sql`GREATEST(0, ${productVariants.stock} - ${item.quantity})`,
                updatedAt: new Date(),
              } as any)
              .where(eq(productVariants.id, item.variantId));
            this.logger.log(`Deducted ${item.quantity} units from variant ${item.variantId} (Order: ${orderNumber})`);
          } catch (stockErr: any) {
            this.logger.warn(`Failed to deduct stock for variant ${item.variantId}: ${stockErr.message}`);
          }
        }
      }

      // 5. Clear Cart in DB
      await this.db.delete(cartItems).where(eq(cartItems.cartId, cartId)).catch(() => null);

      this.logger.log(`Order ${orderNumber} (${orderId}) created successfully for customer ${dto.customerPhone}`);

      return {
        id: orderId,
        orderNumber,
        storeId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail || null,
        shippingAddressLine1: dto.shippingAddressLine1,
        shippingAddressLine2: dto.shippingAddressLine2 || null,
        shippingCity: dto.shippingCity,
        shippingProvince: dto.shippingProvince || 'Pakistan',
        shippingPostalCode: dto.shippingPostalCode || null,
        paymentMethod,
        financialStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
        fulfillmentStatus: 'unfulfilled',
        orderStatus: 'open',
        currency: 'PKR',
        subtotalMinor,
        shippingFeeMinor,
        totalMinor,
        notes: dto.notes || null,
        createdAt: new Date().toISOString(),
        items: cart.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          variantId: i.variantId,
          title: i.title,
          variantTitle: i.variantTitle,
          sku: i.sku,
          unitPriceMinor: i.priceMinor,
          quantity: i.quantity,
          totalMinor: i.totalMinor,
        })),
      };
    } catch (err: any) {
      this.logger.warn(`Failed to persist order in Postgres (${err.message}). Using resilient memory order.`);
    }

    // Resilient Memory Fallback
    const memoryOrder: FormattedOrder = {
      id: orderId,
      orderNumber,
      storeId,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerEmail: dto.customerEmail || null,
      shippingAddressLine1: dto.shippingAddressLine1,
      shippingAddressLine2: dto.shippingAddressLine2 || null,
      shippingCity: dto.shippingCity,
      shippingProvince: dto.shippingProvince || 'Pakistan',
      shippingPostalCode: dto.shippingPostalCode || null,
      paymentMethod,
      financialStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
      fulfillmentStatus: 'unfulfilled',
      orderStatus: 'open',
      currency: 'PKR',
      subtotalMinor,
      shippingFeeMinor,
      totalMinor,
      notes: dto.notes || null,
      createdAt: new Date().toISOString(),
      items: cart.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        variantId: i.variantId,
        title: i.title,
        variantTitle: i.variantTitle,
        sku: i.sku,
        unitPriceMinor: i.priceMinor,
        quantity: i.quantity,
        totalMinor: i.totalMinor,
      })),
    };

    MEMORY_ORDERS.set(orderId, memoryOrder);
    return memoryOrder;
  }

  async getOrderById(orderId: string): Promise<FormattedOrder> {
    try {
      const order = await this.db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: {
          items: true,
        },
      });

      if (order) {
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
          courierName: (order as any).courierName || null,
          courierTrackingNumber: (order as any).courierTrackingNumber || null,
          courierStatus: (order as any).courierStatus || null,
          discountCode: (order as any).discountCode || null,
          discountMinor: (order as any).discountMinor || 0,
          currency: order.currency,
          subtotalMinor: order.subtotalMinor,
          shippingFeeMinor: order.shippingFeeMinor,
          totalMinor: order.totalMinor,
          notes: order.notes,
          createdAt: order.createdAt.toISOString(),
          items: (order as any).items.map((item: any) => ({
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
    } catch (err: any) {
      this.logger.warn(`Postgres order lookup failed (${err.message}). Checking memory fallback.`);
    }

    const mem = MEMORY_ORDERS.get(orderId);
    if (!mem) {
      throw new NotFoundException(`Order with id '${orderId}' not found`);
    }
    return mem;
  }

  async listAdminOrders(storeId: string = 'store_default'): Promise<FormattedOrder[]> {
    try {
      const records = await this.db.query.orders.findMany({
        where: eq(orders.storeId, storeId),
        with: {
          items: true,
        },
      });

      if (records && records.length > 0) {
        return records.map((order) => ({
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
          courierName: (order as any).courierName || null,
          courierTrackingNumber: (order as any).courierTrackingNumber || null,
          courierStatus: (order as any).courierStatus || null,
          discountCode: (order as any).discountCode || null,
          discountMinor: (order as any).discountMinor || 0,
          currency: order.currency,
          subtotalMinor: order.subtotalMinor,
          shippingFeeMinor: order.shippingFeeMinor,
          totalMinor: order.totalMinor,
          notes: order.notes,
          createdAt: order.createdAt.toISOString(),
          items: (order as any).items.map((item: any) => ({
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
        })).reverse();
      }
    } catch (err: any) {
      this.logger.warn(`Postgres listAdminOrders failed (${err.message}). Using memory fallback.`);
    }

    return Array.from(MEMORY_ORDERS.values()).reverse();
  }

  async updateOrderStatus(
    orderId: string,
    update: { financialStatus?: string; fulfillmentStatus?: string; orderStatus?: string }
  ): Promise<FormattedOrder> {
    try {
      await this.db.update(orders)
        .set({ ...update, updatedAt: new Date() } as any)
        .where(eq(orders.id, orderId));
    } catch (err: any) {
      this.logger.warn(`Postgres update order status failed (${err.message}). Updating memory fallback.`);
    }

    const mem = MEMORY_ORDERS.get(orderId);
    if (mem) {
      if (update.financialStatus) mem.financialStatus = update.financialStatus;
      if (update.fulfillmentStatus) mem.fulfillmentStatus = update.fulfillmentStatus;
      if (update.orderStatus) mem.orderStatus = update.orderStatus;
    }

    // Automatic inventory restock if order is cancelled
    if (update.orderStatus === 'cancelled') {
      try {
        const order = await this.getOrderById(orderId);
        if (order && order.items) {
          for (const item of order.items) {
            if (item.variantId) {
              await this.db
                .update(productVariants)
                .set({
                  stock: sql`${productVariants.stock} + ${item.quantity}`,
                  updatedAt: new Date(),
                } as any)
                .where(eq(productVariants.id, item.variantId));
              this.logger.log(`Restocked ${item.quantity} units to variant ${item.variantId} (Cancelled Order: ${order.orderNumber})`);
            }
          }
        }
      } catch (restockErr: any) {
        this.logger.warn(`Failed to restock inventory for order ${orderId}: ${restockErr.message}`);
      }
    }

    return this.getOrderById(orderId);
  }

  async verifyWhatsApp(orderId: string, verifiedBy: 'customer' | 'merchant' = 'merchant'): Promise<FormattedOrder> {
    const order = await this.getOrderById(orderId);
    const tag = `[WhatsApp Verified: ${verifiedBy.toUpperCase()}]`;
    const updatedNotes = order.notes
      ? (order.notes.includes('WhatsApp Verified') ? order.notes : `${order.notes} | ${tag}`)
      : tag;

    try {
      await this.db.update(orders)
        .set({ notes: updatedNotes, updatedAt: new Date() } as any)
        .where(eq(orders.id, orderId));
    } catch (err: any) {
      this.logger.warn(`Postgres verifyWhatsApp update failed: ${err.message}`);
    }

    if (MEMORY_ORDERS.has(orderId)) {
      const mem = MEMORY_ORDERS.get(orderId)!;
      mem.notes = updatedNotes;
    }

    this.logger.log(`Order ${order.orderNumber} marked WhatsApp verified by ${verifiedBy}`);
    return this.getOrderById(orderId);
  }

  async updateOrderNotes(orderId: string, notes: string): Promise<FormattedOrder> {
    try {
      await this.db.update(orders)
        .set({ notes, updatedAt: new Date() } as any)
        .where(eq(orders.id, orderId));
    } catch (err: any) {
      this.logger.warn(`Postgres updateOrderNotes failed: ${err.message}`);
    }

    if (MEMORY_ORDERS.has(orderId)) {
      const mem = MEMORY_ORDERS.get(orderId)!;
      mem.notes = notes;
    }

    return this.getOrderById(orderId);
  }

  async bookCourier(orderId: string, courierName: string = 'Trax') {
    const order = await this.getOrderById(orderId);
    const prefix = courierName.substring(0, 3).toUpperCase();
    const trackingNumber = `${prefix}-${Math.floor(1000000 + Math.random() * 9000000)}`;

    const trackingNote = `Dispatched via ${courierName} (CN: ${trackingNumber})`;
    const updatedNotes = order.notes ? `${order.notes} | ${trackingNote}` : trackingNote;

    await this.updateOrderStatus(orderId, {
      fulfillmentStatus: 'in_transit',
    });

    try {
      await this.db.update(orders)
        .set({ notes: updatedNotes, updatedAt: new Date() } as any)
        .where(eq(orders.id, orderId));
    } catch (err: any) {
      // Memory fallback
    }

    if (MEMORY_ORDERS.has(orderId)) {
      const mem = MEMORY_ORDERS.get(orderId)!;
      mem.fulfillmentStatus = 'in_transit';
      mem.notes = updatedNotes;
    }

    return {
      success: true,
      orderId,
      orderNumber: order.orderNumber,
      courierName,
      trackingNumber,
      estimatedDelivery: '24–48 Hours',
      airwayBillUrl: `/admin/airway-bill/${orderId}?cn=${trackingNumber}`,
    };
  }

  async getAnalytics(storeId: string = 'store_default') {
    const allOrders = await this.listAdminOrders(storeId);

    const nonCancelled = allOrders.filter((o) => o.orderStatus !== 'cancelled');
    const grossRevenueMinor = nonCancelled.reduce((sum, o) => sum + o.totalMinor, 0);
    const pendingCodCashMinor = allOrders
      .filter((o) => o.paymentMethod === 'cod' && o.financialStatus === 'pending' && o.orderStatus !== 'cancelled')
      .reduce((sum, o) => sum + o.totalMinor, 0);

    const unfulfilledCount = allOrders.filter((o) => o.fulfillmentStatus === 'unfulfilled' && o.orderStatus !== 'cancelled').length;
    const inTransitCount = allOrders.filter((o) => o.fulfillmentStatus === 'in_transit').length;
    const deliveredCount = allOrders.filter((o) => o.fulfillmentStatus === 'fulfilled').length;
    const cancelledCount = allOrders.filter((o) => o.orderStatus === 'cancelled').length;

    const rtoRate = allOrders.length > 0 ? ((cancelledCount / allOrders.length) * 100).toFixed(1) : '0.0';

    return {
      grossRevenueMinor,
      totalOrders: allOrders.length,
      pendingCodCashMinor,
      unfulfilledCount,
      inTransitCount,
      deliveredCount,
      cancelledCount,
      rtoRatePercent: parseFloat(rtoRate),
      currency: 'PKR',
    };
  }
}
