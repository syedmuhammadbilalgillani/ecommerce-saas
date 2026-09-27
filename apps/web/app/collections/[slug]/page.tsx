import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { getStorefrontCollection, formatPrice } from '@/lib/api';

export const revalidate = 60; // 60s ISR cache

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getStorefrontCollection(slug);

  if (!collection) {
    notFound();
  }

  const products = (collection.collectionProducts ?? []).map(cp => cp.product);

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link>
        <span style={{ margin: '0 0.5rem' }}>/</span>
        <span style={{ color: 'var(--text)' }}>Collections</span>
        <span style={{ margin: '0 0.5rem' }}>/</span>
        <span style={{ color: 'var(--text)' }}>{collection.title}</span>
      </nav>

      {/* Collection Header */}
      <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 500, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          {collection.title}
        </h1>
        {collection.description && (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '600px' }}>
            {collection.description}
          </p>
        )}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          {products.length} Products Found
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid">
        {products.map((product) => {
          const firstVariant = product.variants[0];
          const priceDisplay = firstVariant ? formatPrice(firstVariant.priceMinor) : 'N/A';

          return (
            <div key={product.id} className="card">
              <div className="card-image-box">
                <ShoppingBag size={32} strokeWidth={1.5} />
              </div>
              <div style={{ padding: '1rem' }}>
                {product.category && (
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    {product.category.name}
                  </div>
                )}
                <h3 className="card-title">{product.title}</h3>
                <p className="card-desc">{product.description || 'Premium craftsmanship.'}</p>
                <div className="card-footer" style={{ marginTop: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From</div>
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
    </div>
  );
}
