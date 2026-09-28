import Link from 'next/link';
import { Zap, ShoppingBag, ArrowRight } from 'lucide-react';
import { getStorefrontProducts, getStorefrontCollections, formatPrice } from '../lib/api';

export const revalidate = 60; // ISR cache for 60 seconds

export default async function HomePage() {
  const [products, collections] = await Promise.all([
    getStorefrontProducts(),
    getStorefrontCollections(),
  ]);

  return (
    <div className="container" style={{ padding: '0 1rem 4rem' }}>
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-pill">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Zap size={13} /> Lightning Commerce</span> • <span>Shopify Taxonomy Architecture</span>
        </div>
        <h1 className="hero-title">
          The Fastest eCommerce Storefront <br />
          <span>Built for High-Growth Brands</span>
        </h1>
        <p className="hero-desc">
          Powered by Next.js 15, NestJS Fastify, and Drizzle ORM. Designed for sub-second page loads on Pakistani 4G networks.
        </p>
      </section>

      {/* Collection Navigation Filter Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <Link
          href="/"
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            textDecoration: 'none',
            background: 'var(--primary-btn)',
            color: 'var(--primary-btn-text)',
            whiteSpace: 'nowrap',
          }}
        >
          All Products
        </Link>
        {collections.map((col) => (
          <Link
            key={col.id}
            href={`/collections/${col.slug}`}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              textDecoration: 'none',
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {col.title}
          </Link>
        ))}
      </div>

      {/* Product Grid */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 500 }}>Featured Catalog</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {products.length} Products Available
          </span>
        </div>

        <div className="grid">
          {products.map((product) => {
            const firstVariant = product.variants[0];
            const priceDisplay = firstVariant ? formatPrice(firstVariant.priceMinor) : 'N/A';

            return (
              <div key={product.id} className="card">
                <div className="card-image-box">
                  {product.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].altText || product.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <ShoppingBag size={32} strokeWidth={1.5} />
                  )}
                </div>
                <div style={{ padding: '1rem' }}>
                  {product.category && (
                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      {product.category.name}
                    </div>
                  )}
                  <h3 className="card-title">{product.title}</h3>
                  <p className="card-desc">{product.description || 'Premium quality apparel handcrafted with care.'}</p>
                  <div className="card-footer" style={{ marginTop: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Starting at</div>
                      <div className="price">{priceDisplay}</div>
                    </div>
                    <Link href={`/products/${product.slug}`} className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span>View Product</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
