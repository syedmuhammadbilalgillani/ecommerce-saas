'use client';

import Link from 'next/link';
import { useCart } from '../lib/cart-context';
import { ThemeToggle } from './theme-toggle';

export function HeaderNav() {
  const { cart, openCart } = useCart();
  const itemCount = cart?.itemCount || 0;

  return (
    <header className="header">
      <div className="container nav">
        <Link href="/" className="brand">
          ⚡ POSflow <span>Commerce</span>
          <span className="speed-badge">&lt; 50ms Edge</span>
        </Link>
        <div className="nav-links">
          <span>🇵🇰 PKR</span>
          <span>English / اردو</span>
          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>● COD Available</span>

          {/* Theme Toggle Button */}
          <ThemeToggle />

          {/* Cart Drawer Trigger Button */}
          <button
            onClick={openCart}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              padding: '0.45rem 0.9rem',
              borderRadius: '9999px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              transition: 'all 0.15s',
            }}
          >
            <span>🛒</span>
            <span>Cart</span>
            <span
              style={{
                background: 'var(--primary-btn)',
                color: 'var(--primary-btn-text)',
                borderRadius: '9999px',
                padding: '0.1rem 0.45rem',
                fontSize: '0.75rem',
                minWidth: '1.25rem',
                textAlign: 'center',
              }}
            >
              {itemCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
