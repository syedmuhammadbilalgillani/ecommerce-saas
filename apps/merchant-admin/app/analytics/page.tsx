'use client';

import React, { useState, useEffect } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { getAnalytics, formatPrice, errorMessage, type MerchantAnalytics } from '@/lib/api';
import { ErrorBanner } from '@/components/error-banner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  DollarSign,
  ShoppingBag,
  Users,
  Truck,
  Download,
  RefreshCw,
  MapPin,
  CreditCard,
  BarChart3,
  Layers,
} from 'lucide-react';

export default function MerchantAnalyticsPage() {
  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMetricTab, setActiveMetricTab] = useState<'sales' | 'orders' | 'aov'>('sales');

  const fetchTelemetry = async () => {
    try {
      setError(null);
      setAnalytics(await getAnalytics());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchTelemetry();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTelemetry();
  };

  const handleExportCSV = () => {
    if (!analytics) return;
    const rows = [
      ['Date', 'Daily Sales (PKR)', 'Orders Count'],
      ...analytics.salesOverTime.map((d) => [d.date, (d.salesMinor / 100).toString(), d.ordersCount.toString()]),
      [],
      ['Top Product', 'Variant', 'Units Sold', 'Revenue (PKR)'],
      ...analytics.topProducts.map((p) => [p.title, p.variantTitle, p.unitsSold.toString(), (p.revenueMinor / 100).toString()]),
      [],
      ['City', 'Orders Count', 'Revenue (PKR)', 'Share %'],
      ...analytics.cityBreakdown.map((c) => [c.city, c.ordersCount.toString(), (c.revenueMinor / 100).toString(), `${c.percentage}%`]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `POSflow_Analytics_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Loading Skeleton State
  if (!loading && !analytics) {
    return (
      <div className="space-y-4 max-w-6xl pb-12">
        <ErrorBanner message={error ?? 'No analytics data returned.'} />
        <Button variant="outline" size="sm" className="text-xs" onClick={handleRefresh}>
          Retry
        </Button>
      </div>
    );
  }

  if (loading || !analytics || !mounted) {
    return (
      <div className="space-y-6 max-w-6xl pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-3 w-44" />
            </Card>
          ))}
        </div>

        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-64 w-full" />
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-36 w-full" />
          </Card>
          <Card className="p-6 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-36 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  const itemsPerOrder =
    analytics.totalOrders > 0 ? (analytics.totalUnits / analytics.totalOrders).toFixed(1) : '0';
  const fulfillmentRate =
    analytics.totalOrders > 0 ? Math.round((analytics.deliveredOrders / analytics.totalOrders) * 100) : 0;

  // Format Recharts Telemetry Data
  const chartData = analytics.salesOverTime.map((d) => {
    const sales = Math.round(d.salesMinor / 100);
    const aov = d.ordersCount > 0 ? Math.round(sales / d.ordersCount) : 0;
    return {
      date: d.date,
      formattedDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sales,
      orders: d.ordersCount,
      aov,
    };
  });

  // Shadcn Chart Configuration (CSS Variable mapped)
  const chartConfig: ChartConfig = {
    sales: {
      label: 'Current Period (PKR)',
      color: 'hsl(var(--chart-1))',
    },
    orders: {
      label: 'Orders',
      color: 'hsl(var(--chart-2))',
    },
    aov: {
      label: 'Avg Order Value (PKR)',
      color: 'hsl(var(--chart-1))',
    },
  };

  // City Breakdown Chart Data & Config
  const cityChartData = analytics.cityBreakdown.map((c) => ({
    city: c.city,
    revenue: Math.round(c.revenueMinor / 100),
    orders: c.ordersCount,
  }));

  const cityChartConfig: ChartConfig = {
    revenue: {
      label: 'Gross Sales (PKR)',
      color: 'hsl(var(--chart-2))',
    },
  };

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Top Header & Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-normal tracking-tight text-foreground">Analytics & Reports</h1>
          </div>
          <p className="text-xs text-muted-foreground font-normal mt-0.5">
            Real-time financial telemetry, product velocity, courier COD transit, and customer retention.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">All-time data</span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 px-2.5"
            title="Refresh Real-time Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 px-3 gap-1.5 text-xs font-normal"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* 4 Core Shopify Standard KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 space-y-0">
            <CardTitle className="text-xs font-normal text-muted-foreground">Total Gross Sales</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-medium text-foreground tracking-tight">
              {formatPrice(analytics.grossSalesMinor)}
            </div>
            <p className="text-[11px] text-muted-foreground font-normal mt-2 border-t border-border/50 pt-1.5">
              Net Sales: <span className="text-foreground">{formatPrice(analytics.netSalesMinor)}</span> (Discounts: -{formatPrice(analytics.discountsMinor)})
            </p>
          </CardContent>
        </Card>

        {/* Average Order Value */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 space-y-0">
            <CardTitle className="text-xs font-normal text-muted-foreground">Average Order Value (AOV)</CardTitle>
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-medium text-foreground tracking-tight">
              {formatPrice(analytics.averageOrderValueMinor)}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                {analytics.totalOrders} Total Orders
              </Badge>
              <span className="text-[11px] text-muted-foreground font-normal">excluding cancelled</span>
            </div>
            <p className="text-[11px] text-muted-foreground font-normal mt-2 border-t border-border/50 pt-1.5">
              Items per order: <span className="text-foreground">{itemsPerOrder} units avg</span>
            </p>
          </CardContent>
        </Card>

        {/* Returning Customer Rate */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 space-y-0">
            <CardTitle className="text-xs font-normal text-muted-foreground">Returning Customer Rate</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-medium text-foreground tracking-tight">
              {analytics.repeatCustomersRate}%
            </div>
            <p className="text-[11px] text-muted-foreground font-normal mt-1.5">Customers with 2+ orders</p>
            <p className="text-[11px] text-muted-foreground font-normal mt-2 border-t border-border/50 pt-1.5">
              Total Buyers: <span className="text-foreground">{analytics.totalCustomers} customer profiles</span>
            </p>
          </CardContent>
        </Card>

        {/* COD Courier & RTO Health */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 space-y-0">
            <CardTitle className="text-xs font-normal text-muted-foreground">Courier COD & RTO Health</CardTitle>
            <Truck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-medium text-foreground tracking-tight">
              {analytics.rtoRatePercent}% <span className="text-xs text-muted-foreground font-normal font-sans">RTO</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                In Transit: {formatPrice(analytics.pendingCodMinor)}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-normal mt-2 border-t border-border/50 pt-1.5">
              RTO = returned orders ÷ all non-cancelled orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Shopify-Style Telemetry Chart using Shadcn Chart Component */}
      <Card className="border border-border">
        {/* Shopify-Style Interactive Metric Header */}
        <CardHeader className="p-0 border-b border-border">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {/* Tab 1: Total Sales */}
            <button
              type="button"
              onClick={() => setActiveMetricTab('sales')}
              className={`p-4 text-left transition-colors cursor-pointer ${
                activeMetricTab === 'sales'
                  ? 'bg-muted/40 border-b-2 border-primary sm:border-b-0'
                  : 'hover:bg-muted/20'
              }`}
            >
              <div className="text-xs text-muted-foreground font-normal">Total Sales</div>
              <div className="text-lg font-medium text-foreground tracking-tight mt-1">
                {formatPrice(analytics.grossSalesMinor)}
              </div>
            </button>

            {/* Tab 2: Orders Count */}
            <button
              type="button"
              onClick={() => setActiveMetricTab('orders')}
              className={`p-4 text-left transition-colors cursor-pointer ${
                activeMetricTab === 'orders'
                  ? 'bg-muted/40 border-b-2 border-primary sm:border-b-0'
                  : 'hover:bg-muted/20'
              }`}
            >
              <div className="text-xs text-muted-foreground font-normal">Orders</div>
              <div className="text-lg font-medium text-foreground tracking-tight mt-1">
                {analytics.totalOrders} Orders
              </div>
              <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                <span>{fulfillmentRate}% delivered</span>
              </div>
            </button>

            {/* Tab 3: Average Order Value */}
            <button
              type="button"
              onClick={() => setActiveMetricTab('aov')}
              className={`p-4 text-left transition-colors cursor-pointer ${
                activeMetricTab === 'aov'
                  ? 'bg-muted/40 border-b-2 border-primary sm:border-b-0'
                  : 'hover:bg-muted/20'
              }`}
            >
              <div className="text-xs text-muted-foreground font-normal">Average Order Value</div>
              <div className="text-lg font-medium text-foreground tracking-tight mt-1">
                {formatPrice(analytics.averageOrderValueMinor)}
              </div>
              <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                <span>Cart size: {itemsPerOrder} items</span>
              </div>
            </button>
          </div>
        </CardHeader>

        {/* Chart Canvas Area */}
        <CardContent className="p-6 pt-6">
          <ChartContainer config={chartConfig} className="h-72 w-full aspect-auto">
            {activeMetricTab === 'sales' ? (
              <AreaChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                <defs>
                  <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-sales)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-sales)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis
                  dataKey="formattedDate"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-[11px] fill-muted-foreground"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(val) => `Rs ${Number(val).toLocaleString()}`}
                  className="text-[11px] fill-muted-foreground"
                />
                <ChartTooltip
                  cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => `Date: ${value}`}
                      formatter={(val, name) => [
                        `Rs ${Number(val).toLocaleString()}`,
                        'Sales',
                      ]}
                    />
                  }
                />
                {/* Current Active Sales Line */}
                <Area
                  dataKey="sales"
                  type="natural"
                  fill="url(#fillSales)"
                  stroke="var(--color-sales)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--color-sales)', strokeWidth: 0 }}
                  activeDot={{ r: 5, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                />
              </AreaChart>
            ) : activeMetricTab === 'orders' ? (
              <BarChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis
                  dataKey="formattedDate"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-[11px] fill-muted-foreground"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-[11px] fill-muted-foreground"
                  allowDecimals={false}
                />
                <ChartTooltip
                  cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar
                  dataKey="orders"
                  fill="var(--color-orders)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            ) : (
              <AreaChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                <defs>
                  <linearGradient id="fillAov" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-aov)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-aov)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis
                  dataKey="formattedDate"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-[11px] fill-muted-foreground"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(val) => `Rs ${Number(val).toLocaleString()}`}
                  className="text-[11px] fill-muted-foreground"
                />
                <ChartTooltip
                  cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent
                      formatter={(val) => [`Rs ${Number(val).toLocaleString()}`, 'Average Order Value']}
                    />
                  }
                />
                <Area
                  dataKey="aov"
                  type="natural"
                  fill="url(#fillAov)"
                  stroke="var(--color-aov)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--color-aov)' }}
                />
              </AreaChart>
            )}
          </ChartContainer>
        </CardContent>

        <CardFooter className="flex items-center justify-between p-4 px-6 border-t border-border/60 bg-muted/20 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Daily sales
            </span>
          </div>
          <span className="font-mono text-[11px]">Timezone: Asia/Karachi (PKT)</span>
        </CardFooter>
      </Card>

      {/* 2-Column Deep Breakdowns Using Shadcn Components */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Top Selling Products (Shadcn Table) */}
        <Card className="border border-border">
          <CardHeader className="p-5 pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  Top Products by Velocity
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Best-selling catalog items ranked by revenue and units sold.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[11px] font-normal">
                {analytics.topProducts.length} Top Items
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Product / Variant</TableHead>
                  <TableHead className="text-center">Units</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topProducts.map((prod, idx) => (
                  <TableRow key={idx} className="group">
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-foreground text-[10px]">
                        {idx + 1}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-normal text-foreground text-xs">{prod.title}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{prod.variantTitle}</div>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-foreground">
                      <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                        {prod.unitsSold}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-xs text-foreground">
                      {formatPrice(prod.revenueMinor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 2. City Distribution Across Pakistan (Shadcn Chart + Progress) */}
        <Card className="border border-border">
          <CardHeader className="p-5 pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  Pakistan Regional Demand
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Shipment volume and cash collection by metropolitan hub.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[11px] font-normal">
                {analytics.cityBreakdown.length} Cities
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Visual Bar Chart for Cities */}
            <ChartContainer config={cityChartConfig} className="h-36 w-full aspect-auto">
              <BarChart data={cityChartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis dataKey="city" tickLine={false} axisLine={false} className="text-[11px] fill-muted-foreground" />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `Rs ${Math.round(val / 1000)}k`}
                  className="text-[11px] fill-muted-foreground"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(val) => [`Rs ${Number(val).toLocaleString()}`, 'City Revenue']}
                    />
                  }
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ChartContainer>

            <Separator className="my-3" />

            {/* City Distribution Details with Progress */}
            <div className="space-y-3">
              {analytics.cityBreakdown.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-normal flex items-center gap-1.5">
                      {item.city}
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono font-normal">
                        {item.ordersCount} {item.ordersCount === 1 ? 'order' : 'orders'}
                      </Badge>
                    </span>
                    <span className="font-mono text-muted-foreground">
                      <span className="text-foreground font-medium">{formatPrice(item.revenueMinor)}</span> ({item.percentage}%)
                    </span>
                  </div>
                  <Progress
                    value={item.percentage}
                    className="h-1.5 bg-secondary"
                    indicatorClassName="bg-emerald-500"
                  />
                </div>
              ))}
            </div>

            <Separator className="my-3" />

            {/* Payment Method Breakdown (COD vs Digital) */}
            <div className="pt-1">
              <div className="flex items-center justify-between text-xs mb-2.5">
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                  Payment Channels Split
                </span>
                <span className="text-[11px] text-muted-foreground">COD dominant market</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {analytics.paymentBreakdown.map((pay, pIdx) => (
                  <div key={pIdx} className="p-2.5 rounded-md border border-border bg-card">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-normal text-foreground">{pay.method}</span>
                      <Badge variant={pay.method === 'COD' ? 'info' : 'outline'} className="text-[10px] px-1.5 py-0 h-4">
                        {pay.ordersCount} orders
                      </Badge>
                    </div>
                    <div className="text-xs font-medium text-foreground">
                      {formatPrice(pay.revenueMinor)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
