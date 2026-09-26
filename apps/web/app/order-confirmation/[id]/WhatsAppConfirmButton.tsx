'use client';

import React, { useState } from 'react';

interface WhatsAppConfirmButtonProps {
  orderId: string;
  orderNumber: string;
  totalFormatted: string;
  customerName: string;
  shippingCity: string;
  storePhone?: string;
  initialVerified?: boolean;
}

export function WhatsAppConfirmButton({
  orderId,
  orderNumber,
  totalFormatted,
  customerName,
  shippingCity,
  storePhone = '923001234567',
  initialVerified = false,
}: WhatsAppConfirmButtonProps) {
  const [verified, setVerified] = useState(initialVerified);
  const [loading, setLoading] = useState(false);

  const message = `Hi! I just placed order #${orderNumber} for Rs. ${totalFormatted} to ${shippingCity}. Please confirm my order for dispatch. Shukriya!`;
  const waUrl = `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`;

  const handleClick = async () => {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (!verified) {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
        await fetch(`${apiUrl}/v1/storefront/orders/${orderId}/verify-whatsapp`, {
          method: 'POST',
        });
        setVerified(true);
      } catch (err) {
        console.error('Failed to mark order verified:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div
      style={{
        background: verified
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(16, 185, 129, 0.04) 100%)'
          : 'linear-gradient(135deg, rgba(37, 211, 102, 0.1) 0%, rgba(18, 140, 126, 0.05) 100%)',
        border: verified ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(37, 211, 102, 0.3)',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '1.25rem',
              flexShrink: 0,
            }}
          >
            💬
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)' }}>
              {verified ? '✓ Order Confirmed via WhatsApp' : '⚡ Fast-Track Dispatch: Confirm via WhatsApp'}
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {verified
                ? 'Your order confirmation has been logged. Our fulfillment team is packaging your order.'
                : 'Pakistani COD orders verified on WhatsApp get priority queue dispatch with Trax express.'}
            </div>
          </div>
        </div>

        <button
          onClick={handleClick}
          disabled={loading}
          style={{
            backgroundColor: verified ? '#166534' : '#25D366',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.65rem 1.25rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'background-color 0.2s',
          }}
        >
          <span>💬</span>
          {verified ? 'WhatsApp Chat Open' : 'Confirm via WhatsApp (1-Click)'}
        </button>
      </div>
    </div>
  );
}
