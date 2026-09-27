'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getOrders,
  bookCourier,
  updateOrderStatus,
  formatPrice,
  verifyWhatsAppOrder,
  formatWhatsAppUrl,
  errorMessage,
  type MerchantOrder,
  type OrderTab,
  type OrderTabCounts,
} from '@/lib/api';
import { ErrorBanner } from '@/components/error-banner';
import { PackingLabel } from '@/components/packing-label';
import {
  Button,
  Input,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui';

export default function MerchantOrdersPage() {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<OrderTabCounts | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedOrderForLabel, setSelectedOrderForLabel] = useState<MerchantOrder | null>(null);
  const [bookingCourierForId, setBookingCourierForId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Wait until typing pauses before searching on the server.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Tab and search are applied by the API; results come back one page at a time.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const page = await getOrders({ tab: activeTab, q: debouncedQuery });
        if (cancelled) return;
        setOrders(page.orders);
        setNextCursor(page.nextCursor);
        setCounts(page.counts);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, debouncedQuery]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await getOrders({ tab: activeTab, q: debouncedQuery, cursor: nextCursor });
      setOrders(prev => [...prev, ...page.orders]);
      setNextCursor(page.nextCursor);
      setCounts(page.counts);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  /** Tab badges change when an order changes state; refresh them without reloading the list. */
  const refreshCounts = () => {
    getOrders({ tab: activeTab, q: debouncedQuery, limit: 1 })
      .then((page) => setCounts(page.counts))
      .catch(() => null);
  };

  const replaceOrder = (updated: MerchantOrder) => {
    setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
    refreshCounts();
  };

  const handleBookCourier = async (orderId: string) => {
    setBookingCourierForId(orderId);
    setError(null);
    try {
      replaceOrder(await bookCourier(orderId, 'Trax'));
    } catch (err) {
      setError(`Courier booking failed: ${errorMessage(err)}`);
    } finally {
      setBookingCourierForId(null);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setError(null);
    try {
      replaceOrder(await updateOrderStatus(orderId, newStatus));
    } catch (err) {
      setError(`Status update failed: ${errorMessage(err)}`);
    }
  };

  const handleWhatsAppVerify = async (order: MerchantOrder) => {
    const formattedAmount = Math.round(order.totalMinor / 100).toLocaleString();
    const msg = `As-salamu alaykum ${order.customerName}, your order #${order.orderNumber} for Rs. ${formattedAmount} (Cash on Delivery) is ready for dispatch to ${order.customerCity}. Please reply 'YES' to confirm your delivery address. Shukriya!`;
    const waUrl = formatWhatsAppUrl(order.customerPhone, msg);
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    setError(null);
    try {
      replaceOrder(await verifyWhatsAppOrder(order.id, 'merchant'));
    } catch (err) {
      setError(`Could not mark order as verified: ${errorMessage(err)}`);
    }
  };

  const filteredOrders = orders;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-normal tracking-tight text-foreground">Orders & Fulfillment</h1>
          <p className="text-xs text-muted-foreground font-normal">
            Manage Cash on Delivery shipments, 1-click WhatsApp customer verification, 1-click Trax booking, and print thermal labels.
          </p>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OrderTab)}>
          <TabsList>
            <TabsTrigger value="all">All Orders ({counts?.all ?? '…'})</TabsTrigger>
            <TabsTrigger value="unverified" className="text-amber-600 dark:text-amber-400">
              Unverified COD ({counts?.unverified ?? '…'})
            </TabsTrigger>
            <TabsTrigger value="pending_dispatch">Pending Dispatch ({counts?.pending_dispatch ?? '…'})</TabsTrigger>
            <TabsTrigger value="in_transit">In Transit ({counts?.in_transit ?? '…'})</TabsTrigger>
            <TabsTrigger value="delivered">Delivered ({counts?.delivered ?? '…'})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({counts?.cancelled ?? '…'})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search order #, customer, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs bg-card"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[110px]">Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Total & Method</TableHead>
              <TableHead>Courier / Tracking</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                  Loading orders...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                  No orders found matching the filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const isBooked = !!order.courierTrackingNumber;
                const isBooking = bookingCourierForId === order.id;

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs text-foreground">
                      <div>
                        <Link
                          href={`/orders/${order.id}`}
                          className="hover:underline font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                        >
                          {order.orderNumber}
                        </Link>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-sans">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs font-normal text-foreground">{order.customerName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{order.customerPhone}</div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-foreground max-w-[200px] truncate">
                        {order.shippingAddress}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-normal">
                        {order.customerCity}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-xs text-foreground font-normal">
                        {formatPrice(order.totalMinor)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-mono">
                          {order.paymentMethod}
                        </span>
                        {order.paymentMethod === 'cod' && (
                          order.whatsappVerified ? (
                            <span className="inline-flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                              ✓ WA Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              Unverified
                            </span>
                          )
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {isBooked ? (
                        <div className="space-y-1">
                          <Badge variant="info" className="text-[10px] font-mono">
                            {order.courierName}: {order.courierTrackingNumber}
                          </Badge>
                          <div className="text-[10px] text-muted-foreground capitalize">
                            Status: {order.status.replace('_', ' ')}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="warning" className="text-[10px]">
                          Pending Dispatch
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {order.paymentMethod === 'cod' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleWhatsAppVerify(order)}
                            title="Send WhatsApp COD verification message"
                            className={`h-7 text-[11px] px-2 font-normal gap-1 ${
                              order.whatsappVerified
                                ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                                : 'text-foreground hover:border-emerald-500/50'
                            }`}
                          >
                            <span className="text-[11px]">💬</span>
                            {order.whatsappVerified ? 'WA Sent' : 'Verify WA'}
                          </Button>
                        )}

                        {!isBooked ? (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleBookCourier(order.id)}
                            disabled={isBooking}
                            className="h-7 text-[11px] px-2.5 font-normal"
                          >
                            {isBooking ? 'Booking...' : 'Book Trax'}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedOrderForLabel(order)}
                            className="h-7 text-[11px] px-2 font-normal"
                          >
                            Print Label
                          </Button>
                        )}

                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className="h-7 rounded bg-card border border-border text-[10px] text-foreground px-1.5 focus:outline-none"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_transit">In Transit</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {nextCursor && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} className="text-xs font-normal">
            {loadingMore ? 'Loading...' : 'Load more orders'}
          </Button>
        </div>
      )}

      {/* 4x6 Packing Label */}
      {selectedOrderForLabel && (
        <PackingLabel order={selectedOrderForLabel} onClose={() => setSelectedOrderForLabel(null)} />
      )}
    </div>
  );
}
