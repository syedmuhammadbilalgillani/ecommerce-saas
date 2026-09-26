import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthError, getAnalytics, getOrders, formatPrice } from '@/lib/api';
import { serverAuthHeaders } from '@/lib/server-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const revalidate = 0; // Fresh metrics

export default async function MerchantDashboardPage() {
  const auth = await serverAuthHeaders();
  let analytics, orders;
  try {
    [analytics, orders] = await Promise.all([getAnalytics(auth), getOrders({ limit: 5 }, auth)]);
  } catch (err) {
    if (err instanceof AuthError) redirect('/login');
    throw err;
  }

  const recentOrders = orders.orders;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-normal tracking-tight text-foreground">Store Overview</h1>
          <p className="text-xs text-muted-foreground font-normal">Real-time metrics, live COD settlements, and fulfillment health.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-3 py-1.5 text-xs font-normal text-foreground hover:bg-secondary transition-colors"
          >
            + Add Product
          </Link>
          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-normal text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Manage Orders
          </Link>
        </div>
      </div>

      {/* 4 Calm KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Gross Sales</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-medium text-foreground">
              {formatPrice(analytics.grossSalesMinor)}
            </div>
            <p className="text-[11px] text-muted-foreground font-normal mt-0.5">Excludes cancelled orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Total Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-medium text-foreground">
              {analytics.totalOrders}
            </div>
            <p className="text-[11px] text-muted-foreground font-normal mt-0.5">Storefront conversions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">COD in Transit</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-medium text-foreground">
              {formatPrice(analytics.pendingCodMinor)}
            </div>
            <p className="text-[11px] text-muted-foreground font-normal mt-0.5">Unpaid COD orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">RTO Return Rate</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-lg font-medium text-foreground">
              {analytics.rtoRatePercent}%
            </div>
            <p className="text-[11px] text-muted-foreground font-normal mt-0.5">Returned orders ÷ all orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-foreground">Recent Customer Orders</h2>
            <p className="text-xs text-muted-foreground font-normal">Latest shipments awaiting courier pickup or dispatch.</p>
          </div>
          <Link href="/orders" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View all ({orders.counts.all}) →
          </Link>
        </div>

        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[120px]">Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                    No orders placed yet. Place an order on the storefront to see it here.
                  </TableCell>
                </TableRow>
              ) : (
                recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs text-foreground">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-foreground">{order.customerName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{order.customerPhone}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {order.customerCity}
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] text-muted-foreground uppercase font-mono">
                        {order.paymentMethod}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-foreground font-normal">
                      {formatPrice(order.totalMinor)}
                    </TableCell>
                    <TableCell>
                      {order.courierTrackingNumber ? (
                        <Badge variant="info" className="text-[10px] font-mono">
                          {order.courierName}: {order.courierTrackingNumber}
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="text-[10px]">
                          Pending Dispatch
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-secondary border border-border transition-colors"
                      >
                        Details
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
