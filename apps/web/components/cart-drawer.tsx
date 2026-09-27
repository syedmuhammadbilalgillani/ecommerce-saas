'use client';

import React from 'react';
import Link from 'next/link';
import { X, ShoppingCart, ShoppingBag, Trash2, Check, ArrowRight } from 'lucide-react';
import { useCart } from '../lib/cart-context';
import { formatPrice } from '../lib/api';

export function CartDrawer() {
  const { cart, isOpen, closeCart, updateQuantity, removeItem, isLoading, error } = useCart();

  if (!isOpen) return null;

  const items = cart?.items || [];
  const itemCount = cart?.itemCount || 0;
  const subtotalMinor = cart?.subtotalMinor || 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div
        onClick={closeCart}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          transition: 'opacity 0.2s',
        }}
      />

      {/* Slide-over Drawer Panel */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '440px',
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 25px rgba(0,0,0,0.5)',
          animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>Your Cart</span>
            <span
              style={{
                background: 'var(--badge-bg)',
                color: 'var(--badge-text)',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button
            onClick={closeCart}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {error && (
            <div
              role="alert"
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid #ef4444',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <ShoppingCart size={48} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.5rem' }}>
                Your cart is empty
              </h3>
              <p style={{ fontSize: '0.875rem' }}>Looks like you haven't added anything to your cart yet.</p>
              <button
                onClick={closeCart}
                className="btn"
                style={{ marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <span>Start Shopping</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    padding: '1rem',
                    background: 'var(--bg)',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      background: 'var(--surface-hover)',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <ShoppingBag size={24} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </h4>
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={isLoading}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 0.25rem',
                        }}
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0' }}>
                      {item.variantTitle}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          border: '1px solid var(--border-color)',
                          borderRadius: '0.35rem',
                          background: 'var(--surface)',
                        }}
                      >
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={isLoading}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text)',
                            padding: '0.2rem 0.6rem',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          -
                        </button>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '1.5rem', textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={isLoading}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text)',
                            padding: '0.2rem 0.6rem',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          +
                        </button>
                      </div>

                      <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.95rem' }}>
                        {formatPrice(item.totalMinor)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {items.length > 0 && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Subtotal</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)' }}>
                {formatPrice(subtotalMinor)}
              </span>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginBottom: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Check size={14} />
              <span>Free standard delivery included across Pakistan</span>
            </div>

            <Link
              href="/checkout"
              onClick={closeCart}
              className="btn"
              style={{
                width: '100%',
                padding: '0.9rem',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              <span>Proceed to Checkout (COD)</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
