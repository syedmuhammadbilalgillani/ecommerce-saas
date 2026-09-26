import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { type Database, orders, orderItems, customers, stores, sql, eq, and, ne, desc } from '@repo/db';

export interface AnalyticsSummary {
  grossSalesMinor: number;
  netSalesMinor: number;
  discountsMinor: number;
  totalOrders: number;
  /** Units across all non-cancelled orders (for items-per-order). */
  totalUnits: number;
  /** Non-cancelled orders marked delivered/fulfilled (for fulfillment rate). */
  deliveredOrders: number;
  averageOrderValueMinor: number;
  pendingCodMinor: number;
  rtoRatePercent: number;
  totalCustomers: number;
  repeatCustomersRate: number;
  salesOverTime: Array<{
    date: string;
    salesMinor: number;
    ordersCount: number;
  }>;
  topProducts: Array<{
    title: string;
    variantTitle: string;
    unitsSold: number;
    revenueMinor: number;
  }>;
  cityBreakdown: Array<{
    city: string;
    ordersCount: number;
    revenueMinor: number;
    percentage: number;
  }>;
  paymentBreakdown: Array<{
    method: string;
    ordersCount: number;
    revenueMinor: number;
  }>;
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Store analytics computed by Postgres aggregates, so cost stays flat as order volume grows
   * (nothing is loaded row-by-row into the API). Cancelled orders never count as sales.
   */
  async getStoreAnalytics(storeId: string): Promise<AnalyticsSummary> {
    const live = and(eq(orders.storeId, storeId), ne(orders.orderStatus, 'cancelled'));

    const [store] = await this.db
      .select({ timezone: stores.timezone })
      .from(stores)
      .where(eq(stores.id, storeId));
    const timezone = store?.timezone || 'Asia/Karachi';
    // Group days in the store's own timezone, not UTC (an 11 pm Karachi order belongs to that day).
    const day = sql<string>`to_char(${orders.createdAt} AT TIME ZONE ${timezone}, 'YYYY-MM-DD')`;
    const city = sql<string>`coalesce(nullif(lower(trim(${orders.shippingCity})), ''), 'other')`;

    const [[totals], [units], [crm], byDay, byCity, byPayment, top] = await Promise.all([
      this.db
        .select({
          orders: sql<number>`count(*)::int`,
          sales: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::bigint`,
          discounts: sql<number>`coalesce(sum(${orders.discountMinor}), 0)::bigint`,
          pendingCod: sql<number>`coalesce(sum(${orders.totalMinor}) FILTER (WHERE ${orders.paymentMethod} = 'cod' AND ${orders.financialStatus} = 'pending'), 0)::bigint`,
          returned: sql<number>`count(*) FILTER (WHERE ${orders.orderStatus} = 'returned' OR ${orders.fulfillmentStatus} = 'returned')::int`,
          delivered: sql<number>`count(*) FILTER (WHERE ${orders.fulfillmentStatus} IN ('delivered', 'fulfilled'))::int`,
        })
        .from(orders)
        .where(live),
      this.db
        .select({ units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::bigint` })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(live),
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          repeat: sql<number>`count(*) FILTER (WHERE ${customers.ordersCount} > 1)::int`,
        })
        .from(customers)
        .where(eq(customers.storeId, storeId)),
      this.db
        .select({ date: day, sales: sql<number>`sum(${orders.totalMinor})::bigint`, count: sql<number>`count(*)::int` })
        .from(orders)
        .where(live)
        // Group/order by position: repeating the expression would bind the timezone as a second
        // parameter, which Postgres treats as a different expression than the selected one.
        .groupBy(sql`1`)
        .orderBy(sql`1`),
      this.db
        .select({ city, count: sql<number>`count(*)::int`, revenue: sql<number>`sum(${orders.totalMinor})::bigint` })
        .from(orders)
        .where(live)
        .groupBy(city)
        .orderBy(desc(sql`count(*)`))
        .limit(20),
      this.db
        .select({
          method: sql<string>`upper(${orders.paymentMethod})`,
          count: sql<number>`count(*)::int`,
          revenue: sql<number>`sum(${orders.totalMinor})::bigint`,
        })
        .from(orders)
        .where(live)
        .groupBy(sql`upper(${orders.paymentMethod})`),
      this.db
        .select({
          title: orderItems.title,
          variantTitle: orderItems.variantTitle,
          units: sql<number>`sum(${orderItems.quantity})::int`,
          revenue: sql<number>`sum(${orderItems.totalMinor})::bigint`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(live)
        .groupBy(orderItems.title, orderItems.variantTitle)
        .orderBy(desc(sql`sum(${orderItems.totalMinor})`))
        .limit(5),
    ]);

    // Postgres bigint arrives as a string; every money figure is converted once, here.
    const n = (v: number | string | null | undefined) => Number(v ?? 0);
    const orderCount = totals.orders;
    const grossSales = n(totals.sales);
    const discountsTotal = n(totals.discounts);

    return {
      grossSalesMinor: grossSales,
      netSalesMinor: grossSales - discountsTotal,
      discountsMinor: discountsTotal,
      totalOrders: orderCount,
      totalUnits: n(units.units),
      deliveredOrders: totals.delivered,
      averageOrderValueMinor: orderCount > 0 ? Math.round(grossSales / orderCount) : 0,
      pendingCodMinor: n(totals.pendingCod),
      rtoRatePercent: orderCount > 0 ? Math.round((totals.returned / orderCount) * 100) : 0,
      totalCustomers: crm.total,
      repeatCustomersRate: crm.total > 0 ? Math.round((crm.repeat / crm.total) * 100) : 0,
      salesOverTime: byDay.map((d) => ({ date: d.date, salesMinor: n(d.sales), ordersCount: d.count })),
      topProducts: top.map((t) => ({
        title: t.title,
        variantTitle: t.variantTitle,
        unitsSold: t.units,
        revenueMinor: n(t.revenue),
      })),
      cityBreakdown: byCity.map((c) => ({
        city: c.city.charAt(0).toUpperCase() + c.city.slice(1),
        ordersCount: c.count,
        revenueMinor: n(c.revenue),
        percentage: orderCount > 0 ? Math.round((c.count / orderCount) * 100) : 0,
      })),
      paymentBreakdown: byPayment.map((p) => ({ method: p.method, ordersCount: p.count, revenueMinor: n(p.revenue) })),
    };
  }
}
