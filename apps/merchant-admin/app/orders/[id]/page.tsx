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
  errorMessage,
  type MerchantOrder,
} from '@/lib/api';
import { ErrorBanner } from '@/components/error-banner';
import { PackingLabel } from '@/components/packing-label';
import { FULFILLMENT_LABEL, isMajorMetro, isPakistaniMobile } from '@/lib/order-checks';
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui';

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

  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const data = await getOrderById(id);
        setOrder(data);
        setNoteText(data.notes || '');
      } catch (err) {
        const message = errorMessage(err);
        if (/not found/i.test(message)) setNotFound(true);
        else setError(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const runAction = async (label: string, action: () => Promise<MerchantOrder>) => {
    setError(null);
    try {
      const updated = await action();
      setOrder(updated);
      return updated;
    } catch (err) {
      setError(`${label}: ${errorMessage(err)}`);
      return null;
    }
  };

  const handleBookCourier = async () => {
    if (!order) return;
    setBookingCourier(true);
    await runAction('Courier booking failed', () => bookCourier(order.id, 'Trax'));
    setBookingCourier(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    await runAction('Status update failed', () => updateOrderStatus(order.id, newStatus));
  };

  const handleWhatsAppVerify = async () => {
    if (!order) return;
    const formattedAmount = Math.round(order.totalMinor / 100).toLocaleString();
    const msg = `As-salamu alaykum ${order.customerName}, your order #${order.orderNumber} for Rs. ${formattedAmount} (Cash on Delivery) is confirmed and being prepared for dispatch to ${order.customerCity}. Please reply 'YES' if you have any delivery instructions. Shukriya!`;
    const waUrl = formatWhatsAppUrl(order.customerPhone, msg);
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    await runAction('Could not mark order as verified', () => verifyWhatsAppOrder(order.id, 'merchant'));
  };

  const handleSaveNotes = async () => {
    if (!order) return;
    setSavingNote(true);
    const updated = await runAction('Saving notes failed', () => updateOrderNotes(order.id, noteText));
    if (updated) setNoteText(updated.notes || '');
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
        <h2 className="text-base font-medium text-foreground">{notFound ? 'Order Not Found' : 'Could not load order'}</h2>
        <p className="text-xs text-muted-foreground">{notFound ? 'The requested order could not be located.' : error}</p>
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
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

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
                  <span className="font-mono">{FULFILLMENT_LABEL[order.status] ?? order.status}</span>
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
                      Customer checked out via Cash on Delivery ({order.customerCity})
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
                  <div>
                    <div className="text-foreground font-medium">Inventory Stock Deducted</div>
                    <div className="text-[11px] text-muted-foreground">
                      Stock reduced for {order.items.length} line item{order.items.length === 1 ? '' : 's'} at checkout
                    </div>
                  </div>
                </div>

                {order.whatsappVerified && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
                    <div>
                      <div className="text-foreground font-medium">Marked WhatsApp-verified</div>
                      <div className="text-[11px] text-muted-foreground">
                        {order.notes?.includes('Verified: CUSTOMER')
                          ? 'Customer opened the WhatsApp confirmation from the order page'
                          : 'Merchant sent the WhatsApp confirmation message'}
                      </div>
                    </div>
                  </div>
                )}

                {isCancelled && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1" />
                    <div>
                      <div className="text-foreground font-medium">Order Cancelled</div>
                      <div className="text-[11px] text-muted-foreground">Stock was returned to inventory</div>
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
                        Consignment #{order.courierTrackingNumber} (generated in POSflow)
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

          {/* COD Checks (computed from this order's own data) */}
          <Card>
            <CardHeader className="p-5 pb-3 border-b border-border">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <span>🛡️</span>
                <span>COD Checks</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Phone number</span>
                {isPakistaniMobile(order.customerPhone) ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Pakistani mobile</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Not a Pakistani mobile</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Destination</span>
                <span className="font-medium text-foreground">
                  {isMajorMetro(order.customerCity) ? 'Major metro' : 'Outside major metros'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">WhatsApp confirmation</span>
                {order.whatsappVerified ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Done</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Not yet</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4x6 Packing Label */}
      {showThermalLabel && <PackingLabel order={order} onClose={() => setShowThermalLabel(false)} />}
    </div>
  );
}
