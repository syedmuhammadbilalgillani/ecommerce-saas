import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { type Database, customers, orders, eq, and, sql } from '@repo/db';

export interface CustomerSyncDto {
  name: string;
  phone: string;
  email?: string;
  address?: {
    address1: string;
    city: string;
    province?: string;
  };
  orderTotalMinor: number;
}

@Injectable()
export class CustomersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }

  async getCustomers(storeId: string = 'store_default') {
    const list = await this.db
      .select()
      .from(customers)
      .orderBy(sql`${customers.totalSpentMinor} DESC`);

    return list.map((c) => ({
      ...c,
      avgOrderValueMinor:
        c.ordersCount > 0 ? Math.round(c.totalSpentMinor / c.ordersCount) : 0,
    }));
  }

  async getCustomerById(id: string) {
    const customerList = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    if (!customerList || customerList.length === 0) {
      throw new NotFoundException(`Customer with ID "${id}" not found.`);
    }

    const customer = customerList[0];

    // Fetch order history for this customer
    const customerOrders = await this.db
      .select()
      .from(orders)
      .where(eq(orders.customerPhone, customer.phone))
      .orderBy(sql`${orders.createdAt} DESC`);

    return {
      ...customer,
      avgOrderValueMinor:
        customer.ordersCount > 0
          ? Math.round(customer.totalSpentMinor / customer.ordersCount)
          : 0,
      orders: customerOrders,
    };
  }

  /**
   * Shopify-Style Automatic Customer Sync on Order Checkout
   */
  async syncCustomerFromOrder(
    dto: CustomerSyncDto,
    storeId: string = 'store_default',
    tenantId: string = 'ten_pilot_01'
  ): Promise<string> {
    const cleanPhone = this.normalizePhone(dto.phone);
    if (!cleanPhone) return '';

    // Split name into first & last
    const nameParts = dto.name.trim().split(' ');
    const firstName = nameParts[0] || dto.name;
    const lastName = nameParts.slice(1).join(' ') || '';

    // Check if customer exists by phone
    const existing = await this.db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.phone, cleanPhone),
          eq(customers.storeId, storeId)
        )
      )
      .limit(1);

    if (existing && existing.length > 0) {
      const cust = existing[0];
      const newOrdersCount = cust.ordersCount + 1;
      const newTotalSpent = cust.totalSpentMinor + dto.orderTotalMinor;

      // Smart VIP tagging if LTV exceeds 10,000 PKR (1,000,000 minor)
      let tags = cust.tags || [];
      if (newTotalSpent >= 1000000 && !tags.includes('vip')) {
        tags = [...tags, 'vip'];
      }
      if (newOrdersCount >= 2 && !tags.includes('repeat_buyer')) {
        tags = [...tags, 'repeat_buyer'];
      }

      await this.db
        .update(customers)
        .set({
          firstName: firstName || cust.firstName,
          lastName: lastName || cust.lastName,
          email: dto.email ? dto.email.trim() : cust.email,
          ordersCount: newOrdersCount,
          totalSpentMinor: newTotalSpent,
          tags,
          defaultAddress: dto.address ? (dto.address as any) : cust.defaultAddress,
          updatedAt: new Date(),
        } as any)
        .where(eq(customers.id, cust.id));

      return cust.id;
    }

    // New customer registration
    const newId = this.generateId('cust');
    const initialTags = ['first_time_buyer'];
    if (dto.address?.city) {
      initialTags.push(dto.address.city.toLowerCase());
    }

    await this.db.insert(customers).values({
      id: newId,
      tenantId,
      storeId,
      firstName,
      lastName,
      phone: cleanPhone,
      email: dto.email ? dto.email.trim() : null,
      ordersCount: 1,
      totalSpentMinor: dto.orderTotalMinor,
      state: 'enabled',
      tags: initialTags,
      defaultAddress: dto.address ? (dto.address as any) : null,
    } as any);

    return newId;
  }
}
