import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProductBySlug } from '../../../lib/api';
import { VariantSelector } from './variant-selector';

export const revalidate = 60;

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const categoryName = product.category?.name;

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 5rem' }}>
      {/* Category Hierarchy Breadcrumb */}
      <nav style={{ marginBottom: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link>
        <span style={{ margin: '0 0.5rem' }}>/</span>
        {categoryName && (
          <>
            <span>{categoryName}</span>
            <span style={{ margin: '0 0.5rem' }}>/</span>
          </>
        )}
        <span style={{ color: 'var(--text)' }}>{product.title}</span>
      </nav>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '3rem',
          alignItems: 'start',
        }}
      >
        {/* Product Media Gallery */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            height: '420px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '5rem',
          }}
        >
          🛍️
        </div>

        {/* Product Details & Purchase Island */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                {product.vendor || 'Outfitters PK'}
              </span>
              {product.category && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  • {product.category.name}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
              {product.title}
            </h1>
          </div>

          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.9rem' }}>
            {product.description || 'Premium quality apparel handcrafted with care.'}
          </p>

          {/* Interactive Client Island (Variant Buttons + Instant Fastify Add-to-Cart) */}
          <VariantSelector variants={product.variants} />

          {/* Value Props */}
          <div
            style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: '1.25rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
            }}
          >
            <div>⚡ <strong>Next-Day Delivery</strong><br />Across Karachi, Lahore & Islamabad</div>
            <div>💵 <strong>Cash on Delivery</strong><br />Pay cash at your doorstep</div>
          </div>
        </div>
      </div>
    </div>
  );
}
