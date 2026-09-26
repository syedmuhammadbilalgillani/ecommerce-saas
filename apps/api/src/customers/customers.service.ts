import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DRIZZLE } from '../db/db.module';
import type { DbExecutor } from '../db/store-context';
import { type Database, customers, orders, eq, and, or, lt, desc, ilike, sql } from '@repo/db';
import { decodeCursor, encodeCursor, likePattern } from '../common/pagination';
import { normalizePhone } from './phone';

const VIP_THRESHOLD_MINOR = 1_000_000; // Rs 10,000 lifetime spend

export { normalizePhone } from './phone';

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
    return `${prefix}_${randomBytes(12).toString('hex')}`;
  }

  /** One page of customers (highest lifetime spend first) plus store-wide CRM stats. */
  async getCustomers(storeId: string, query: { limit: number; cursor?: string; q?: string }) {
    const search = query.q?.trim();
    // Drop a leading trunk "0" so local input (0300…) matches stored international numbers (+92300…).
    const digits = search?.replace(/\D/g, '').replace(/^0+/, '');
    const searchCondition = search
      ? or(
          ilike(sql`${customers.firstName} || ' ' || coalesce(${customers.lastName}, '')`, likePattern(search)),
          ilike(customers.email, likePattern(search)),
          // Phones are stored normalized (+923…); match on digits so "0300 123" style input works.
          digits ? ilike(sql`regexp_replace(${customers.phone}, '[^0-9]', '', 'g')`, likePattern(digits)) : undefined
        )
      : undefined;

    const cursor = decodeCursor(query.cursor);
    const cursorCondition = cursor
      ? or(
          lt(customers.totalSpentMinor, Number(cursor.sortValue)),
          and(eq(customers.totalSpentMinor, Number(cursor.sortValue)), lt(customers.id, cursor.id))
        )
      : undefined;

    const [rows, [stats]] = await Promise.all([
      this.db
        .select()
        .from(customers)
        .where(and(eq(customers.storeId, storeId), searchCondition, cursorCondition))
        .orderBy(desc(customers.totalSpentMinor), desc(customers.id))
        .limit(query.limit + 1),
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          repeat: sql<number>`count(*) FILTER (WHERE ${customers.ordersCount} > 1)::int`,
          totalSpentMinor: sql<number>`coalesce(sum(${customers.totalSpentMinor}), 0)::bigint`,
        })
        .from(customers)
        .where(eq(customers.storeId, storeId)),
    ]);

    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      data: page.map((c) => ({
        ...c,
        avgOrderValueMinor: c.ordersCount > 0 ? Math.round(c.totalSpentMinor / c.ordersCount) : 0,
      })),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last.totalSpentMinor, last.id) : null,
      stats: {
        total: stats.total,
        repeat: stats.repeat,
        avgLifetimeValueMinor: stats.total > 0 ? Math.round(Number(stats.totalSpentMinor) / stats.total) : 0,
      },
    };
  }

  async getCustomerById(storeId: string, id: string) {
    const customerList = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.storeId, storeId)))
      .limit(1);

    if (!customerList || customerList.length === 0) {
      throw new NotFoundException(`Customer with ID "${id}" not found.`);
    }

    const customer = customerList[0];

    // Fetch order history for this customer
    const customerOrders = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.customerPhone, customer.phone)))
      .orderBy(sql`${orders.createdAt} DESC`)
      .limit(100);

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
   * Records an order against its customer (matched by store + phone) in a single upsert,
   * so concurrent orders from the same shopper can't lose counts or create duplicates.
   * Runs inside the checkout transaction.
   */
  async syncCustomerFromOrder(
    executor: DbExecutor,
    dto: CustomerSyncDto,
    storeId: string,
    tenantId: string
  ): Promise<string | null> {
    const phone = normalizePhone(dto.phone);
    if (!phone) return null;

    const nameParts = dto.name.trim().split(/\s+/);
    const firstName = nameParts[0] || dto.name.trim();
    const lastName = nameParts.slice(1).join(' ');
    const email = dto.email?.trim() || null;
    const address = dto.address ?? null;

    const initialTags = ['first_time_buyer'];
    if (dto.address?.city) initialTags.push(dto.address.city.trim().toLowerCase());

    const [row] = await executor
      .insert(customers)
      .values({
        id: this.generateId('cust'),
        tenantId,
        storeId,
        firstName,
        lastName,
        phone,
        email,
        ordersCount: 1,
        totalSpentMinor: dto.orderTotalMinor,
        state: 'enabled',
        tags: initialTags,
        defaultAddress: address,
      })
      .onConflictDoUpdate({
        target: [customers.storeId, customers.phone],
        set: {
          firstName,
          lastName: sql`COALESCE(NULLIF(${lastName}, ''), ${customers.lastName})`,
          email: sql`COALESCE(${email}, ${customers.email})`,
          ordersCount: sql`${customers.ordersCount} + 1`,
          totalSpentMinor: sql`${customers.totalSpentMinor} + ${dto.orderTotalMinor}`,
          defaultAddress: sql`COALESCE(${address ? JSON.stringify(address) : null}::jsonb, ${customers.defaultAddress})`,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: customers.id,
        ordersCount: customers.ordersCount,
        totalSpentMinor: customers.totalSpentMinor,
        tags: customers.tags,
      });

    // The upsert holds this row's lock until the transaction ends, so this follow-up is race-free.
    const tags = new Set(row.tags);
    if (row.totalSpentMinor >= VIP_THRESHOLD_MINOR) tags.add('vip');
    if (row.ordersCount >= 2) {
      tags.add('repeat_buyer');
      tags.delete('first_time_buyer');
    }
    const nextTags = [...tags];
    if (nextTags.length !== row.tags.length || nextTags.some((t, i) => t !== row.tags[i])) {
      await executor.update(customers).set({ tags: nextTags }).where(eq(customers.id, row.id));
    }

    return row.id;
  }
}
