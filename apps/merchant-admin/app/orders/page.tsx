'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getOrders, bookCourier, updateOrderStatus, formatPrice, verifyWhatsAppOrder, formatWhatsAppUrl, errorMessage, type MerchantOrder } from '@/lib/api';
import { ErrorBanner } from '@/components/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function MerchantOrdersPage() {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForLabel, setSelectedOrderForLabel] = useState<MerchantOrder | null>(null);
  const [bookingCourierForId, setBookingCourierForId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setOrders(await getOrders());
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const replaceOrder = (updated: MerchantOrder) => {
    setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
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

  // Filter orders by tab and search
  const filteredOrders = orders.filter(order => {
    if (activeTab === 'unverified' && (order.paymentMethod !== 'cod' || order.whatsappVerified)) return false;
    if (activeTab === 'pending' && order.courierTrackingNumber) return false;
    if (activeTab === 'in_transit' && order.status !== 'in_transit') return false;
    if (activeTab === 'delivered' && order.status !== 'delivered') return false;
    if (activeTab === 'cancelled' && order.status !== 'cancelled') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = order.customerName.toLowerCase().includes(q);
      const matchPhone = order.customerPhone.toLowerCase().includes(q);
      const matchNum = order.orderNumber.toLowerCase().includes(q);
      const matchTrack = (order.courierTrackingNumber || '').toLowerCase().includes(q);
      return matchName || matchPhone || matchNum || matchTrack;
    }

    return true;
  });

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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All Orders ({orders.length})</TabsTrigger>
            <TabsTrigger value="unverified" className="text-amber-600 dark:text-amber-400">
              Unverified COD ({orders.filter(o => o.paymentMethod === 'cod' && !o.whatsappVerified).length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending Dispatch ({orders.filter(o => !o.courierTrackingNumber).length})
            </TabsTrigger>
            <TabsTrigger value="in_transit">
              In Transit ({orders.filter(o => o.status === 'in_transit').length})
            </TabsTrigger>
            <TabsTrigger value="delivered">Delivered</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
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

      {/* 4x6 Thermal Airway Bill Printable Modal */}
      {selectedOrderForLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white text-zinc-950 rounded-lg max-w-sm w-full p-6 shadow-2xl font-mono text-xs border border-zinc-300">
            {/* Header */}
            <div className="border-b-2 border-black pb-3 text-center">
              <div className="text-base font-bold tracking-tight">TRAX LOGISTICS (COD)</div>
              <div className="text-[10px] text-zinc-600">DOMESTIC COURIER AIRWAY BILL (4x6)</div>
              <div className="mt-2 text-lg font-bold tracking-wider bg-zinc-100 py-1 border border-zinc-300 rounded">
                {selectedOrderForLabel.courierTrackingNumber || 'TRX-DEFAULT'}
              </div>
            </div>

            {/* Recipient Details */}
            <div className="py-3 border-b border-zinc-300 space-y-1">
              <div className="text-[10px] text-zinc-500 uppercase">Deliver To:</div>
              <div className="font-bold text-sm">{selectedOrderForLabel.customerName}</div>
              <div className="text-xs">{selectedOrderForLabel.customerPhone}</div>
              <div className="text-xs text-zinc-800 mt-1">{selectedOrderForLabel.shippingAddress}</div>
              <div className="font-bold text-xs uppercase mt-0.5">{selectedOrderForLabel.customerCity}</div>
            </div>

            {/* COD Collectable Amount */}
            <div className="py-3 border-b-2 border-black flex justify-between items-center bg-zinc-50 px-2 my-2 rounded">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase font-bold">Cash on Delivery</div>
                <div className="text-[10px] text-zinc-500">Collect from customer</div>
              </div>
              <div className="text-base font-bold">
                {formatPrice(selectedOrderForLabel.totalMinor)}
              </div>
            </div>

            {/* Package Contents */}
            <div className="py-2 text-[10px] text-zinc-600 space-y-1">
              <div>Order Ref: #{selectedOrderForLabel.orderNumber}</div>
              <div>Shipper: Outfitters PK (Karachi Fulfillment Hub)</div>
              <div>Weight: 0.50 KG (Flyer standard)</div>
            </div>

            {/* Simulated Barcode */}
            <div className="pt-3 text-center border-t border-zinc-300">
              <div className="font-mono text-xl tracking-widest select-none">
                ||| | |||| | ||||| ||| |||| |
              </div>
              <div className="text-[9px] text-zinc-500 mt-1">Scan at transit dispatch hub</div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex justify-end gap-2 border-t border-zinc-200 pt-3 font-sans">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedOrderForLabel(null)}
                className="h-8 text-xs text-zinc-700 border-zinc-300 hover:bg-zinc-100"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="h-8 text-xs bg-zinc-900 text-white hover:bg-zinc-800"
              >
                🖨️ Print Label
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
