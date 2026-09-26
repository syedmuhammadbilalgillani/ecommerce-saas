import React from 'react';
import Link from 'next/link';
import { API_URL, formatPrice, getStoreInfo, storefrontHeaders } from '../../../lib/api';
import { WhatsAppConfirmButton } from './WhatsAppConfirmButton';

interface OrderConfirmationProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

async function getOrder(id: string, token: string | undefined) {
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/v1/storefront/orders/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: storefrontHeaders({ 'x-order-token': token }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    console.error('Failed to fetch order details:', err);
    return null;
  }
}

export default async function OrderConfirmationPage({ params, searchParams }: OrderConfirmationProps) {
  const { id } = await params;
  const { token } = await searchParams;
  const [order, store] = await Promise.all([getOrder(id, token), getStoreInfo().catch(() => null)]);
  // wa.me wants digits only (country code included, no '+').
  const storeWhatsApp = store?.whatsappPhone?.replace(/\D/g, '') || null;

  if (!order) {
    return (
      <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>Order not found</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          We couldn&apos;t load this order. Please open the link from your order confirmation, or contact the store on WhatsApp.
        </p>
        <Link href="/" className="btn" style={{ padding: '0.8rem 1.75rem', textDecoration: 'none' }}>
          Back to Store
        </Link>
      </div>
    );
  }

  const items = order.items || [];
  const isVerified = !!(order.notes && order.notes.includes('WhatsApp Verified'));

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      {/* Success Hero */}
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(34, 197, 94, 0.12) 0%, rgba(15, 23, 42, 0.4) 100%)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '16px',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#22c55e',
            color: '#000',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 800,
            marginBottom: '1rem',
          }}
        >
          ✓
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          Order Confirmed!
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1.25rem' }}>
          Thank you, <strong style={{ color: 'var(--text)' }}>{order.customerName}</strong>! Your order has been placed successfully.
        </p>

        <div
          style={{
            display: 'inline-block',
            background: 'var(--bg)',
            border: '1px solid var(--border-color)',
            padding: '0.5rem 1.25rem',
            borderRadius: '9999px',
            fontSize: '0.9rem',
            color: 'var(--accent)',
            fontWeight: 700,
          }}
        >
          Order Reference: {order.orderNumber}
        </div>
      </div>

      {/* WhatsApp COD Verification Flow */}
      {order.paymentMethod === 'cod' && storeWhatsApp && (
        <WhatsAppConfirmButton
          storePhone={storeWhatsApp}
          orderId={order.id}
          accessToken={token!}
          orderNumber={order.orderNumber}
          totalFormatted={Math.round(order.totalMinor / 100).toLocaleString()}
          customerName={order.customerName}
          shippingCity={order.shippingCity}
          initialVerified={isVerified}
        />
      )}

      {/* COD Notice Box */}
      {order.paymentMethod === 'cod' && (
        <div
          style={{
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.25)',
            borderRadius: '12px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <span style={{ fontSize: '1.75rem' }}>💵</span>
          <div>
            <div style={{ fontWeight: 700, color: '#facc15', fontSize: '0.95rem' }}>
              Cash on Delivery (COD) Payment Pending
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Please keep <strong>{formatPrice(order.totalMinor, order.currency)}</strong> in exact cash ready. Our courier will call on <strong>{order.customerPhone}</strong> prior to delivery.
            </div>
          </div>
        </div>
      )}

      {/* Two Column Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Shipping Details */}
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📍</span> Delivery Information
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <div><strong style={{ color: 'var(--text)' }}>Recipient:</strong> {order.customerName}</div>
            <div><strong style={{ color: 'var(--text)' }}>Phone:</strong> {order.customerPhone}</div>
            <div>
              <strong style={{ color: 'var(--text)' }}>Address:</strong> {order.shippingAddressLine1}
              {order.shippingAddressLine2 ? `, ${order.shippingAddressLine2}` : ''}
            </div>
            <div><strong style={{ color: 'var(--text)' }}>City:</strong> {order.shippingCity}</div>
            {order.notes && (
              <div style={{ marginTop: '0.5rem', fontStyle: 'italic', fontSize: '0.85rem' }}>
                &ldquo;{order.notes}&rdquo;
              </div>
            )}
          </div>
        </div>

        {/* Courier Dispatch Estimate */}
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🚚</span> Courier & Tracking
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <div><strong style={{ color: 'var(--text)' }}>Service:</strong> Standard Express (TCS / Leopards / Trax)</div>
            <div><strong style={{ color: 'var(--text)' }}>Estimated Delivery:</strong> 2–3 Business Days</div>
            <div><strong style={{ color: 'var(--text)' }}>Fulfillment Status:</strong> <span style={{ color: '#38bdf8', fontWeight: 600 }}>Processing in Warehouse</span></div>
            <div><strong style={{ color: 'var(--text)' }}>Shipping Fee:</strong> <span style={{ color: '#4ade80', fontWeight: 700 }}>FREE</span></div>
          </div>
        </div>
      </div>

      {/* Itemized Receipt (Frozen Snapshots) */}
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>
          Purchased Items ({items.length})
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {items.map((item: any) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Variant: {item.variantTitle} • SKU: {item.sku} • Qty: {item.quantity}
                </div>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1rem' }}>
                {formatPrice(item.totalMinor, order.currency)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', fontSize: '1.25rem', fontWeight: 800 }}>
          <span>Total Paid on Delivery</span>
          <span style={{ color: '#38bdf8' }}>{formatPrice(order.totalMinor, order.currency)}</span>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ textAlign: 'center' }}>
        <Link
          href="/"
          className="btn"
          style={{
            padding: '0.9rem 2.5rem',
            fontSize: '1rem',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          ← Continue Shopping
        </Link>
      </div>
    </div>
  );
}
