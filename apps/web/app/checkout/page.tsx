'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../../lib/cart-context';
import { formatPrice } from '../../lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

const MAJOR_CITIES = [
  'Karachi',
  'Lahore',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Sialkot',
  'Gujranwala',
  'Hyderabad',
  'Abbottabad',
  'Bahawalpur',
  'Sargodha',
  'Sukkur',
  'Other',
];

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, isLoading: isCartLoading, clearCart } = useCart();

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    shippingAddressLine1: '',
    shippingAddressLine2: '',
    shippingCity: 'Karachi',
    customCity: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Shopify-Style Promo Code State
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    discountType: string;
    value: number;
    discountAmountMinor: number;
    message: string;
    validatedSubtotalMinor: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);

  const items = cart?.items || [];
  const subtotalMinor = cart?.subtotalMinor || 0;
  const shippingFeeMinor = 0; // Free delivery promo
  const discountMinor = appliedDiscount ? appliedDiscount.discountAmountMinor : 0;
  const totalMinor = Math.max(0, subtotalMinor - discountMinor + shippingFeeMinor);

  // A discount was priced against a specific subtotal; if the cart changes, make the shopper re-apply it
  // so the total shown always matches what the server will charge.
  useEffect(() => {
    if (appliedDiscount && appliedDiscount.validatedSubtotalMinor !== subtotalMinor) {
      setAppliedDiscount(null);
      setDiscountError('Your cart changed — please apply the discount code again.');
    }
  }, [subtotalMinor, appliedDiscount]);

  const handleApplyDiscount = async () => {
    if (!promoCodeInput.trim()) return;
    setDiscountError(null);
    setIsValidatingDiscount(true);

    try {
      const res = await fetch(`${API_URL}/v1/storefront/discounts/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promoCodeInput.trim(),
          subtotalMinor,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Invalid or expired coupon code');
      }

      setAppliedDiscount({ ...json.data, validatedSubtotalMinor: subtotalMinor });
      setPromoCodeInput('');
    } catch (err: any) {
      setDiscountError(err.message || 'Could not apply coupon');
    } finally {
      setIsValidatingDiscount(false);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountError(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic Validation
    if (!formData.customerName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    const cleanPhone = formData.customerPhone.replace(/[\s-]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage('Please provide a valid Pakistani mobile number (e.g. 03001234567).');
      return;
    }

    if (!formData.shippingAddressLine1.trim()) {
      setErrorMessage('Please enter your street address and house number.');
      return;
    }

    const selectedCity = formData.shippingCity === 'Other' ? formData.customCity.trim() : formData.shippingCity;
    if (!selectedCity) {
      setErrorMessage('Please specify your city.');
      return;
    }

    if (!cart?.id || items.length === 0) {
      setErrorMessage('Your cart is empty. Add items before completing checkout.');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        cartId: cart.id,
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerEmail: formData.customerEmail.trim() || undefined,
        shippingAddressLine1: formData.shippingAddressLine1.trim(),
        shippingAddressLine2: formData.shippingAddressLine2.trim() || undefined,
        shippingCity: selectedCity,
        paymentMethod: 'cod',
        discountCode: appliedDiscount ? appliedDiscount.code : undefined,
        notes: formData.notes.trim() || undefined,
      };

      const res = await fetch(`${API_URL}/v1/storefront/orders/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cart-id': cart.id,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to place order');
      }

      const order = json.data;
      clearCart();
      router.push(`/order-confirmation/${order.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit order. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!isCartLoading && items.length === 0) {
    return (
      <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛍️</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>Your Cart is Empty</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Explore our premium catalog to add products before checking out.
        </p>
        <Link href="/" className="btn" style={{ padding: '0.8rem 1.75rem', textDecoration: 'none' }}>
          ← Back to Catalog
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Top Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', fontSize: '0.85rem' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Home</Link>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Checkout</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem', alignItems: 'start' }}>
        {/* Left Column: One-Page Checkout Form */}
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              One-Page Express Checkout
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No upfront payment required. Pay in cash when the courier arrives at your doorstep.
            </p>
          </div>

          {errorMessage && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                color: '#f87171',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Section 1: Customer Contact */}
            <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <span style={{ background: 'var(--accent)', color: '#000', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>1</span>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Contact Information</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                    Full Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="customerName"
                    required
                    placeholder="e.g. Syed Ali"
                    value={formData.customerName}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                      Mobile / WhatsApp <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="tel"
                      name="customerPhone"
                      required
                      placeholder="0300-1234567"
                      value={formData.customerPhone}
                      onChange={handleChange}
                      style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                      Email Address <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <input
                      type="email"
                      name="customerEmail"
                      placeholder="ali@example.com"
                      value={formData.customerEmail}
                      onChange={handleChange}
                      style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Delivery Address */}
            <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <span style={{ background: 'var(--accent)', color: '#000', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>2</span>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Shipping & Delivery Address</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                    Street Address / House / Flat # <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="shippingAddressLine1"
                    required
                    placeholder="House 42, Street 10, Sector F-7/2"
                    value={formData.shippingAddressLine1}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                      Area / Landmark
                    </label>
                    <input
                      type="text"
                      name="shippingAddressLine2"
                      placeholder="Near Gol Market"
                      value={formData.shippingAddressLine2}
                      onChange={handleChange}
                      style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                      City <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      name="shippingCity"
                      value={formData.shippingCity}
                      onChange={handleChange}
                      style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem', boxSizing: 'border-box' }}
                    >
                      {MAJOR_CITIES.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.shippingCity === 'Other' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                      Enter Your City Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="customCity"
                      required
                      placeholder="e.g. Kasur, Larkana, Mirpur"
                      value={formData.customCity}
                      onChange={handleChange}
                      style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.95rem', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                    Special Instructions / Notes
                  </label>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="e.g. Call before delivery, deliver after 2 PM"
                    value={formData.notes}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text)', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Payment Method */}
            <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <span style={{ background: 'var(--accent)', color: '#000', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>3</span>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Payment Method</h2>
              </div>

              <div
                style={{
                  border: '2px solid var(--accent)',
                  background: 'rgba(56, 189, 248, 0.05)',
                  padding: '1rem 1.25rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '5px solid var(--accent)', background: '#fff' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Cash on Delivery (COD)</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pay with cash when your package is delivered</div>
                  </div>
                </div>
                <span style={{ fontSize: '1.3rem' }}>💵</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn"
              style={{
                width: '100%',
                padding: '1.1rem',
                fontSize: '1.1rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? (
                <span>Placing Your Order...</span>
              ) : (
                <>
                  <span>Confirm Order ({formatPrice(totalMinor)})</span>
                  <span>→</span>
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              🔒 100% Secure Checkout • Courier dispatch within 24 hours across Pakistan
            </div>
          </form>
        </div>

        {/* Right Column: Order Summary & Invariant Badges */}
        <div style={{ background: 'var(--surface)', padding: '1.75rem', borderRadius: '14px', border: '1px solid var(--border-color)', position: 'sticky', top: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem' }}>
            Order Summary ({items.length} {items.length === 1 ? 'item' : 'items'})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', maxHeight: '360px', overflowY: 'auto' }}>
            {items.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Variant: {item.variantTitle} • Qty: {item.quantity}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.95rem' }}>
                  {formatPrice(item.totalMinor)}
                </div>
              </div>
            ))}
          </div>

          {/* Shopify-Style Promo Code Input */}
          <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            {appliedDiscount ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontWeight: 600 }}>
                  <span>🏷️</span>
                  <span>{appliedDiscount.code} (-{formatPrice(appliedDiscount.discountAmountMinor)})</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveDiscount}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    textDecoration: 'underline',
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Discount code (e.g. WELCOME10)"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyDiscount();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleApplyDiscount}
                    disabled={isValidatingDiscount || !promoCodeInput.trim()}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: '8px',
                      background: 'var(--surface-hover)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: isValidatingDiscount || !promoCodeInput.trim() ? 'not-allowed' : 'pointer',
                      opacity: isValidatingDiscount || !promoCodeInput.trim() ? 0.6 : 1,
                    }}
                  >
                    {isValidatingDiscount ? '...' : 'Apply'}
                  </button>
                </div>
                {discountError && (
                  <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                    {discountError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cost Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <span>Subtotal</span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatPrice(subtotalMinor)}</span>
            </div>
            {appliedDiscount && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#10b981' }}>
                <span>Discount ({appliedDiscount.code})</span>
                <span style={{ fontWeight: 600 }}>-{formatPrice(appliedDiscount.discountAmountMinor)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <span>Nationwide Standard Shipping</span>
              <span style={{ color: '#4ade80', fontWeight: 700 }}>FREE</span>
            </div>
            <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 800 }}>
              <span>Total Amount</span>
              <span style={{ color: '#38bdf8' }}>{formatPrice(totalMinor)}</span>
            </div>
          </div>

          {/* Guarantee Badges */}
          <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📦</span>
              <span><strong>Express Dispatch:</strong> Dispatched via Leopards/Trax in 24h</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔄</span>
              <span><strong>Easy Returns:</strong> 7-day hassle-free exchange guarantee</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🇵🇰</span>
              <span><strong>Local Support:</strong> Direct WhatsApp support available</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
