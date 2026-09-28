'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ShoppingCart, Zap, Lock } from 'lucide-react';
import { type ProductOption, type ProductVariant, formatPrice } from '../../../lib/api';
import { useCart } from '../../../lib/cart-context';

function optionValue(variant: ProductVariant, index: number): string | null | undefined {
  if (index === 0) return variant.option1;
  if (index === 1) return variant.option2;
  if (index === 2) return variant.option3;
  return null;
}

export function VariantSelector({
  variants,
  options,
}: {
  variants: ProductVariant[];
  options?: ProductOption[] | null;
}) {
  // Structured options (Shopify-style option1/2/3) let us render one pill row per
  // axis (Size, Color, ...) instead of one pill per whole variant title.
  const structuredOptions = useMemo(
    () => (options ?? []).filter((opt) => variants.some((v, _i) => opt.values.some((val) => [v.option1, v.option2, v.option3].includes(val)))),
    [options, variants]
  );
  const useStructuredSelector = structuredOptions.length > 0;

  const [selectedValues, setSelectedValues] = useState<Record<string, string>>(() => {
    const first = variants[0];
    const initial: Record<string, string> = {};
    structuredOptions.forEach((opt, idx) => {
      const val = first ? optionValue(first, idx) : null;
      if (val) initial[opt.name] = val;
    });
    return initial;
  });
  const [selectedId, setSelectedId] = useState(variants[0]?.id || '');
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const { addItem, closeCart, isLoading, error } = useCart();
  const router = useRouter();

  const activeVariant = useMemo(() => {
    if (useStructuredSelector) {
      const match = variants.find((v) =>
        structuredOptions.every((opt, idx) => optionValue(v, idx) === selectedValues[opt.name])
      );
      return match || variants[0];
    }
    return variants.find((v) => v.id === selectedId) || variants[0];
  }, [useStructuredSelector, structuredOptions, selectedValues, selectedId, variants]);

  const handleAddToCart = async () => {
    if (!activeVariant) return;
    await addItem(activeVariant.id, 1);
  };

  const handleBuyNow = async () => {
    if (!activeVariant) return;
    setIsBuyingNow(true);
    const ok = await addItem(activeVariant.id, 1);
    if (ok) {
      closeCart();
      router.push('/checkout');
    } else {
      setIsBuyingNow(false);
    }
  };

  if (!activeVariant) return null;

  const inStock = activeVariant.stock > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Price Display */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8' }}>
            {formatPrice(activeVariant.priceMinor)}
          </span>
          {activeVariant.compareAtPriceMinor && (
            <span style={{ fontSize: '1.125rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
              {formatPrice(activeVariant.compareAtPriceMinor)}
            </span>
          )}
        </div>
        {inStock ? (
          <p style={{ color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 600, marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Check size={16} />
            <span>In Stock{activeVariant.stock <= 5 ? ` (only ${activeVariant.stock} left)` : ''} • Ships within 24 hours</span>
          </p>
        ) : (
          <p style={{ color: '#ef4444', fontSize: '0.875rem', fontWeight: 600, marginTop: '0.25rem' }}>
            Sold out
          </p>
        )}
      </div>

      {/* Variant Selector */}
      {useStructuredSelector ? (
        structuredOptions.map((opt) => (
          <div key={opt.name}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              {opt.name}: {selectedValues[opt.name]}
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {opt.values.map((val) => {
                const isSelected = selectedValues[opt.name] === val;
                return (
                  <button
                    key={val}
                    onClick={() => setSelectedValues((prev) => ({ ...prev, [opt.name]: val }))}
                    style={{
                      background: isSelected ? 'var(--primary-btn)' : 'var(--surface)',
                      color: isSelected ? 'var(--primary-btn-text)' : 'var(--text)',
                      border: isSelected ? '1px solid var(--primary-btn)' : '1px solid var(--border-color)',
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      transition: 'all 0.15s',
                    }}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      ) : (
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Select Variant / Size:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {variants.map((v) => {
              const isSelected = v.id === activeVariant.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  style={{
                    background: isSelected ? 'var(--primary-btn)' : 'var(--surface)',
                    color: isSelected ? 'var(--primary-btn-text)' : 'var(--text)',
                    border: isSelected ? '1px solid var(--primary-btn)' : '1px solid var(--border-color)',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    transition: 'all 0.15s',
                  }}
                >
                  {v.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Order Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button
          onClick={handleAddToCart}
          disabled={isLoading || isBuyingNow || !inStock}
          className="btn"
          style={{
            padding: '1rem',
            fontSize: '1rem',
            width: '100%',
            background: 'var(--primary-btn)',
            color: 'var(--primary-btn-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <ShoppingCart size={18} />
          <span>{!inStock ? 'Sold Out' : isLoading && !isBuyingNow ? 'Adding to Cart...' : 'Add to Cart'}</span>
        </button>

        <button
          onClick={handleBuyNow}
          disabled={isLoading || isBuyingNow || !inStock}
          className="btn btn-secondary"
          style={{
            padding: '0.85rem',
            fontSize: '0.95rem',
            width: '100%',
            color: 'var(--text)',
            borderColor: 'var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <Zap size={16} />
          <span>{isBuyingNow ? 'Redirecting to Checkout...' : 'Buy with Cash on Delivery (COD)'}</span>
        </button>

        {error && (
          <div role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
          <Lock size={13} />
          <span>Pay upon Delivery • 7 Days Hassle-Free Exchange</span>
        </div>
      </div>
    </div>
  );
}
