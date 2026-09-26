import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { type Database, orders, orderItems, customers, sql, eq, inArray } from '@repo/db';

export interface AnalyticsSummary {
  grossSalesMinor: number;
  netSalesMinor: number;
  discountsMinor: number;
  totalOrders: number;
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

  async getStoreAnalytics(storeId: string): Promise<AnalyticsSummary> {
    // 1. Orders for this store only; cancelled orders never count as sales
    const allOrders = await this.db
      .select()
      .from(orders)
      .where(eq(orders.storeId, storeId))
      .orderBy(sql`${orders.createdAt} ASC`);
    const orderList = allOrders.filter((o) => o.orderStatus !== 'cancelled');

    // 2. Line items belonging to those orders
    const itemsList =
      orderList.length > 0
        ? await this.db
            .select()
            .from(orderItems)
            .where(inArray(orderItems.orderId, orderList.map((o) => o.id)))
        : [];

    // 3. Customers of this store
    const custList = await this.db.select().from(customers).where(eq(customers.storeId, storeId));

    let grossSales = 0;
    let totalDiscounts = 0;
    let pendingCod = 0;
    let rtoCount = 0;

    const salesByDateMap = new Map<string, { sales: number; count: number }>();
    const cityMap = new Map<string, { count: number; revenue: number }>();
    const paymentMap = new Map<string, { count: number; revenue: number }>();

    for (const ord of orderList) {
      grossSales += ord.totalMinor;
      totalDiscounts += ord.discountMinor || 0;

      if (ord.paymentMethod === 'cod' && ord.financialStatus === 'pending') {
        pendingCod += ord.totalMinor;
      }

      if (ord.orderStatus === 'returned' || ord.fulfillmentStatus === 'returned') {
        rtoCount++;
      }

      // Daily breakdown
      const dateKey = new Date(ord.createdAt).toISOString().split('T')[0];
      const existingDate = salesByDateMap.get(dateKey) || { sales: 0, count: 0 };
      salesByDateMap.set(dateKey, {
        sales: existingDate.sales + ord.totalMinor,
        count: existingDate.count + 1,
      });

      // City breakdown
      const cityKey = ord.shippingCity
        ? ord.shippingCity.trim().toLowerCase()
        : 'other';
      const formattedCity = cityKey.charAt(0).toUpperCase() + cityKey.slice(1);
      const existingCity = cityMap.get(formattedCity) || { count: 0, revenue: 0 };
      cityMap.set(formattedCity, {
        count: existingCity.count + 1,
        revenue: existingCity.revenue + ord.totalMinor,
      });

      // Payment method breakdown
      const methodKey = ord.paymentMethod ? ord.paymentMethod.toUpperCase() : 'COD';
      const existingPay = paymentMap.get(methodKey) || { count: 0, revenue: 0 };
      paymentMap.set(methodKey, {
        count: existingPay.count + 1,
        revenue: existingPay.revenue + ord.totalMinor,
      });
    }

    // Top Selling Products
    const productMap = new Map<string, { title: string; variantTitle: string; units: number; revenue: number }>();
    for (const item of itemsList) {
      const key = `${item.title}-${item.variantTitle}`;
      const existingProd = productMap.get(key) || {
        title: item.title,
        variantTitle: item.variantTitle,
        units: 0,
        revenue: 0,
      };
      productMap.set(key, {
        title: item.title,
        variantTitle: item.variantTitle,
        units: existingProd.units + item.quantity,
        revenue: existingProd.revenue + item.totalMinor,
      });
    }

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({
        title: p.title,
        variantTitle: p.variantTitle,
        unitsSold: p.units,
        revenueMinor: p.revenue,
      }));

    // Format City Breakdown with %
    const totalOrdersCount = orderList.length;
    const cityBreakdown = Array.from(cityMap.entries())
      .map(([city, val]) => ({
        city,
        ordersCount: val.count,
        revenueMinor: val.revenue,
        percentage: Math.round((val.count / totalOrdersCount) * 100),
      }))
      .sort((a, b) => b.ordersCount - a.ordersCount);

    // Repeat customer rate
    const repeatCount = custList.filter((c) => c.ordersCount > 1).length;
    const repeatRate =
      custList.length > 0 ? Math.round((repeatCount / custList.length) * 100) : 0;

    const salesOverTime = Array.from(salesByDateMap.entries()).map(([date, val]) => ({
      date,
      salesMinor: val.sales,
      ordersCount: val.count,
    }));

    const aov =
      totalOrdersCount > 0 ? Math.round(grossSales / totalOrdersCount) : 0;
    const rtoRate =
      totalOrdersCount > 0 ? Math.round((rtoCount / totalOrdersCount) * 100) : 0;

    return {
      grossSalesMinor: grossSales,
      netSalesMinor: grossSales - totalDiscounts,
      discountsMinor: totalDiscounts,
      totalOrders: totalOrdersCount,
      averageOrderValueMinor: aov,
      pendingCodMinor: pendingCod,
      rtoRatePercent: rtoRate,
      totalCustomers: custList.length,
      repeatCustomersRate: repeatRate,
      salesOverTime,
      topProducts,
      cityBreakdown,
      paymentBreakdown: Array.from(paymentMap.entries()).map(([method, val]) => ({
        method,
        ordersCount: val.count,
        revenueMinor: val.revenue,
      })),
    };
  }
}
