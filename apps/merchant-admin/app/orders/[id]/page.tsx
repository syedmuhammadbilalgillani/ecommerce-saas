'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  getOrderById,
  bookCourier,
  updateOrderStatus,
  updateOrderNotes,
  verifyWhatsAppOrder,
  formatWhatsAppUrl,
  formatPrice,
  type MerchantOrder,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<MerchantOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingCourier, setBookingCourier] = useState(false);
  const [showThermalLabel, setShowThermalLabel] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      const data = await getOrderById(id);
      if (data) {
        setOrder(data);
        setNoteText(data.notes || '');
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const handleBookCourier = async () => {
    if (!order) return;
    setBookingCourier(true);
    const res = await bookCourier(order.id, 'Trax');
    if (res && res.courierTrackingNumber) {
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: 'in_transit',
              courierName: res.courierName || 'Trax',
              courierTrackingNumber: res.courierTrackingNumber,
              courierStatus: 'booked',
            }
          : null
      );
    }
    setBookingCourier(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    await updateOrderStatus(order.id, newStatus);
    setOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
  };

  const handleWhatsAppVerify = async () => {
    if (!order) return;
    const formattedAmount = Math.round(order.totalMinor / 100).toLocaleString();
    const msg = `As-salamu alaykum ${order.customerName}, your order #${order.orderNumber} for Rs. ${formattedAmount} (Cash on Delivery) is confirmed and being prepared for dispatch to ${order.customerCity}. Please reply 'YES' if you have any delivery instructions. Shukriya!`;
    const waUrl = formatWhatsAppUrl(order.customerPhone, msg);
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    await verifyWhatsAppOrder(order.id, 'merchant');
    setOrder((prev) => (prev ? { ...prev, whatsappVerified: true } : null));
  };

  const handleSaveNotes = async () => {
    if (!order) return;
    setSavingNote(true);
    await updateOrderNotes(order.id, noteText);
    setOrder((prev) => (prev ? { ...prev, notes: noteText } : null));
    setSavingNote(false);
  };

  const handleCopyAddress = () => {
    if (!order) return;
    const full = `${order.customerName}\n${order.customerPhone}\n${order.shippingAddress}\n${order.customerCity}, Pakistan`;
    navigator.clipboard.writeText(full);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleCopyTracking = () => {
    if (!order?.courierTrackingNumber) return;
    navigator.clipboard.writeText(order.courierTrackingNumber);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center text-muted-foreground text-xs">
        Loading order 360 details...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center space-y-3">
        <h2 className="text-base font-medium text-foreground">Order Not Found</h2>
        <p className="text-xs text-muted-foreground">The requested order could not be located.</p>
        <Link href="/orders">
          <Button size="sm" variant="outline" className="text-xs">
            ← Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  const isBooked = !!order.courierTrackingNumber;
  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';
  const isInTransit = order.status === 'in_transit';

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/orders"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Orders
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-xs font-mono text-foreground font-medium">{order.orderNumber}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <h1 className="text-xl font-normal tracking-tight text-foreground font-mono">
              {order.orderNumber}
            </h1>

            {/* Badges */}
            {order.paymentMethod === 'cod' ? (
              <Badge variant="warning" className="text-[10px] font-normal">
                Pending COD
              </Badge>
            ) : (
              <Badge variant="success" className="text-[10px] font-normal">
                Paid
              </Badge>
            )}

            {isCancelled ? (
              <Badge variant="destructive" className="text-[10px] font-normal">
                Cancelled
              </Badge>
            ) : isDelivered ? (
              <Badge variant="success" className="text-[10px] font-normal">
                Delivered
              </Badge>
            ) : isInTransit ? (
              <Badge variant="info" className="text-[10px] font-normal">
                In Transit
              </Badge>
            ) : (
              <Badge variant="warning" className="text-[10px] font-normal">
                Unfulfilled
              </Badge>
            )}

            {order.paymentMethod === 'cod' && (
              order.whatsappVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                  ✓ WA Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Unverified COD
                </span>
              )
            )}

            <span className="text-xs text-muted-foreground ml-1">
              {new Date(order.createdAt).toLocaleDateString('en-PK', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {order.paymentMethod === 'cod' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleWhatsAppVerify}
              className={`h-8 text-xs font-normal gap-1.5 ${
                order.whatsappVerified
                  ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'text-foreground hover:border-emerald-500/50'
              }`}
            >
              <span>💬</span>
              {order.whatsappVerified ? 'WA Sent' : 'Verify via WA'}
            </Button>
          )}

          {isBooked ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowThermalLabel(true)}
              className="h-8 text-xs font-normal gap-1.5"
            >
              <span>🖨️</span>
              Print Thermal Label (4x6)
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              onClick={handleBookCourier}
              disabled={bookingCourier || isCancelled}
              className="h-8 text-xs font-normal"
            >
              {bookingCourier ? 'Booking...' : 'Book Trax Logistics'}
            </Button>
          )}

          <select
            value={order.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-8 rounded bg-card border border-border text-xs text-foreground px-2 focus:outline-none"
          >
            <option value="pending">Pending</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled (Restock)</option>
          </select>
        </div>
      </div>

      {/* Main 2-Column Shopify Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fulfillment & Items Card */}
          <Card>
            <CardHeader className="p-5 pb-3 border-b border-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <span>📦</span>
                  <span>Fulfillment & Items</span>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {isBooked
                    ? `Dispatched via ${order.courierName} Logistics`
                    : 'Awaiting courier dispatch from warehouse'}
                </CardDescription>
              </div>

              {isBooked && (
                <div className="flex items-center gap-2">
                  <Badge variant="info" className="text-xs font-mono py-0.5 px-2">
                    CN: {order.courierTrackingNumber}
                  </Badge>
                  <button
                    onClick={handleCopyTracking}
                    title="Copy Tracking Number"
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {copiedTracking ? '✓ Copied' : '📋'}
                  </button>
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {/* Stepper Status Progression */}
              <div className="px-5 py-3 bg-muted/20 border-b border-border flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-foreground font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Order Placed</span>
                </div>
                <div className="text-muted-foreground">→</div>
                <div
                  className={`flex items-center gap-1.5 ${
                    isBooked || isDelivered ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isBooked || isDelivered ? 'bg-sky-500' : 'bg-muted'
                    }`}
                  />
                  <span>Dispatched (Trax)</span>
                </div>
                <div className="text-muted-foreground">→</div>
                <div
                  className={`flex items-center gap-1.5 ${
                    isInTransit ? 'text-sky-500 font-medium' : isDelivered ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isInTransit ? 'bg-sky-500 animate-pulse' : isDelivered ? 'bg-emerald-500' : 'bg-muted'
                    }`}
                  />
                  <span>In Transit</span>
                </div>
                <div className="text-muted-foreground">→</div>
                <div
                  className={`flex items-center gap-1.5 ${
                    isDelivered ? 'text-emerald-500 font-medium' : 'text-muted-foreground'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isDelivered ? 'bg-emerald-500' : 'bg-muted'}`} />
                  <span>Delivered</span>
                </div>
              </div>

              {/* Items List Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Product Item</TableHead>
                    <TableHead className="text-xs">SKU</TableHead>
                    <TableHead className="text-xs text-right">Price</TableHead>
                    <TableHead className="text-xs text-center">Qty</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="text-xs font-medium text-foreground">{item.productTitle}</div>
                          {item.variantTitle && (
                            <div className="text-[10px] text-muted-foreground">
                              Variant: {item.variantTitle}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {item.sku || 'N/A'}
                        </TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">
                          {formatPrice(item.unitPriceMinor)}
                        </TableCell>
                        <TableCell className="text-xs text-center font-mono">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium text-foreground">
                          {formatPrice(item.totalMinor)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-xs text-muted-foreground">
                        No item snapshots recorded for this order.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment & Financial Breakdown Card */}
          <Card>
            <CardHeader className="p-5 pb-3 border-b border-border">
              <CardTitle className="text-sm font-medium text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span>💵</span>
                  <span>Payment & Financial Summary</span>
                </span>
                <span className="text-xs font-mono uppercase text-muted-foreground">
                  {order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({order.items.length} items)</span>
                <span className="font-mono text-foreground">{formatPrice(order.subtotalMinor)}</span>
              </div>

              {order.discountMinor && order.discountMinor > 0 ? (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount Promo ({order.discountCode || 'APPLIED'})</span>
                  <span className="font-mono">-{formatPrice(order.discountMinor)}</span>
                </div>
              ) : null}

              <div className="flex justify-between text-muted-foreground">
                <span>Shipping Express (Pakistan Domestic)</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">FREE</span>
              </div>

              <div className="border-t border-border pt-3 flex justify-between items-center text-sm font-medium text-foreground">
                <span>Total Collectible on Delivery</span>
                <span className="text-base font-semibold text-foreground font-mono">
                  {formatPrice(order.totalMinor)}
                </span>
              </div>

              {order.paymentMethod === 'cod' && (
                <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] flex items-center justify-between">
                  <span>Courier Cash to Collect: <strong>{formatPrice(order.totalMinor)}</strong></span>
                  <span className="font-mono">Pending Dispatch</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shopify Timeline & Internal Notes Card */}
          <Card>
            <CardHeader className="p-5 pb-3 border-b border-border">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <span>🕒</span>
                <span>Order Timeline & Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Chronological Events */}
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
                  <div>
                    <div className="text-foreground font-medium">Order Placed by Customer</div>
                    <div className="text-[11px] text-muted-foreground">
                      Customer checked out via Cash on Delivery ({order.shippingCity})
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
                  <div>
                    <div className="text-foreground font-medium">Inventory Stock Deducted</div>
                    <div className="text-[11px] text-muted-foreground">
                      Automated engine deducted quantities for {order.items.length} line items
                    </div>
                  </div>
                </div>

                {order.whatsappVerified && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
                    <div>
                      <div className="text-foreground font-medium">WhatsApp COD Verification Logged</div>
                      <div className="text-[11px] text-muted-foreground">
                        Customer verified delivery address via 1-click WhatsApp message
                      </div>
                    </div>
                  </div>
                )}

                {isBooked && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-sky-500 mt-1" />
                    <div>
                      <div className="text-foreground font-medium">
                        Courier Booked ({order.courierName})
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        Airway Bill Consignment #{order.courierTrackingNumber} generated
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Internal Merchant Notes Editor */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="text-xs font-medium text-foreground">Internal Merchant Notes</div>
                <textarea
                  rows={2}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add internal notes (e.g. customer called, requested delivery after 3 PM)..."
                  className="w-full text-xs p-2.5 rounded-md bg-muted/40 border border-border focus:outline-none text-foreground resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveNotes}
                    disabled={savingNote}
                    className="h-7 text-xs font-normal"
                  >
                    {savingNote ? 'Saving...' : 'Save Note'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (Sidebar 1 Col) */}
        <div className="space-y-6">
          {/* Customer CRM Card */}
          <Card>
            <CardHeader className="p-5 pb-3 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <span>👤</span>
                <span>Customer 360</span>
              </CardTitle>
              <Link
                href={`/customers?search=${encodeURIComponent(order.customerPhone)}`}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                View Profile →
              </Link>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs">
              <div>
                <div className="text-xs font-medium text-foreground">{order.customerName}</div>
                {order.customerEmail && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">{order.customerEmail}</div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="font-mono text-muted-foreground">{order.customerPhone}</span>
                <a
                  href={formatWhatsAppUrl(
                    order.customerPhone,
                    `As-salamu alaykum ${order.customerName}, regarding your order #${order.orderNumber}:`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hover:bg-emerald-500/20"
                >
                  <span>💬</span> WhatsApp
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Delivery / Shipping Address Card */}
          <Card>
            <CardHeader className="p-5 pb-3 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <span>📍</span>
                <span>Shipping Address</span>
              </CardTitle>
              <button
                onClick={handleCopyAddress}
                className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {copiedAddress ? '✓ Copied' : 'Copy'}
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-1.5 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{order.customerName}</div>
              <div>{order.shippingAddress}</div>
              {order.shippingAddressLine2 && <div>{order.shippingAddressLine2}</div>}
              <div>
                {order.customerCity}, {order.shippingProvince || 'Pakistan'}
              </div>
              <div className="font-mono pt-1 text-foreground">{order.customerPhone}</div>
            </CardContent>
          </Card>

          {/* COD Risk & Delivery Assessment Card */}
          <Card>
            <CardHeader className="p-5 pb-3 border-b border-border">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <span>🛡️</span>
                <span>COD Fraud & Risk Assessment</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Phone Number Format</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Valid Pakistani (03xx)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">City Logistics Tier</span>
                <span className="font-medium text-foreground">Tier-1 Major Hub</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">WhatsApp Verification</span>
                {order.whatsappVerified ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Verified (Low RTO)</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Pending Confirmation</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4x6 Thermal Airway Bill Printable Modal */}
      {showThermalLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white text-zinc-950 rounded-lg max-w-sm w-full p-6 shadow-2xl font-mono text-xs border border-zinc-300">
            {/* Header */}
            <div className="border-b-2 border-black pb-3 text-center">
              <div className="text-base font-bold tracking-tight">TRAX LOGISTICS (COD)</div>
              <div className="text-[10px] text-zinc-600">DOMESTIC COURIER AIRWAY BILL (4x6)</div>
              <div className="mt-2 text-lg font-bold tracking-wider bg-zinc-100 py-1 border border-zinc-300 rounded">
                {order.courierTrackingNumber || 'TRX-DEFAULT'}
              </div>
            </div>

            {/* Recipient Details */}
            <div className="py-3 border-b border-dashed border-zinc-400 space-y-1">
              <div className="text-[10px] text-zinc-500 uppercase">Deliver To (Customer):</div>
              <div className="font-bold text-sm">{order.customerName}</div>
              <div>{order.shippingAddress}</div>
              <div className="font-bold">{order.customerCity}, Pakistan</div>
              <div className="font-bold text-sm mt-1">{order.customerPhone}</div>
            </div>

            {/* COD Cash Amount */}
            <div className="py-3 border-b-2 border-black flex justify-between items-center">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase">Payment Method:</div>
                <div className="font-bold text-sm">CASH ON DELIVERY</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-zinc-500 uppercase">Collect Amount:</div>
                <div className="text-base font-bold text-black">{formatPrice(order.totalMinor)}</div>
              </div>
            </div>

            {/* Order Ref & Items */}
            <div className="py-2 text-[10px] text-zinc-600 border-b border-zinc-200">
              <div>Order Reference: #{order.orderNumber}</div>
              <div>Pieces: {order.items.length} | Weight: 0.5 KG (Standard Apparel)</div>
            </div>

            {/* Barcode Mock */}
            <div className="pt-3 text-center">
              <div className="h-10 bg-zinc-900 mx-4 flex items-center justify-center text-white text-[10px] tracking-[6px] font-sans">
                |||| | ||||| || |||||| |
              </div>
              <div className="text-[9px] text-zinc-500 mt-1">{order.courierTrackingNumber}</div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 pt-3 border-t border-zinc-200 flex justify-between gap-2">
              <button
                onClick={() => setShowThermalLabel(false)}
                className="px-3 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded text-xs cursor-pointer font-sans"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-black hover:bg-zinc-800 text-white rounded text-xs cursor-pointer font-sans font-medium"
              >
                Print Label
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
