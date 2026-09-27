'use client';

import React, { useState } from 'react';
import {
  adjustStock,
  errorMessage,
  updateProduct,
  updateVariant,
  type MerchantProduct,
  type MerchantProductVariant,
} from '@/lib/api';
import { slugify } from '@/lib/slug';
import { Button, Input, Label } from '@repo/ui';
import { ErrorBanner } from '@/components/error-banner';

/** Rupees typed by the merchant -> integer minor units (paisa). */
function toMinor(rupees: string): number {
  return Math.round(parseFloat(rupees || '0') * 100);
}
function toRupees(minor: number | null | undefined): string {
  return minor == null ? '' : String(minor / 100);
}

function VariantRow({
  productId,
  variant,
  onUpdated,
  onError,
}: {
  productId: string;
  variant: MerchantProductVariant;
  onUpdated: (p: MerchantProduct) => void;
  onError: (msg: string) => void;
}) {
  const [sku, setSku] = useState(variant.sku);
  const [price, setPrice] = useState(toRupees(variant.priceMinor));
  const [compareAt, setCompareAt] = useState(toRupees(variant.compareAtPriceMinor));
  const [delta, setDelta] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty =
    sku !== variant.sku ||
    toMinor(price) !== variant.priceMinor ||
    (compareAt === '' ? null : toMinor(compareAt)) !== (variant.compareAtPriceMinor ?? null);

  const run = async (action: () => Promise<MerchantProduct>) => {
    setBusy(true);
    try {
      onUpdated(await action());
    } catch (err) {
      onError(`${variant.title}: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const saveVariant = () =>
    run(() =>
      updateVariant(productId, variant.id, {
        sku: sku.trim(),
        priceMinor: toMinor(price),
        compareAtPriceMinor: compareAt === '' ? null : toMinor(compareAt),
      })
    );

  const applyDelta = () => {
    const n = parseInt(delta, 10);
    if (!Number.isInteger(n) || n === 0) {
      onError(`${variant.title}: enter a whole number such as 10 or -3`);
      return;
    }
    run(async () => {
      const updated = await adjustStock(productId, variant.id, n);
      setDelta('');
      return updated;
    });
  };

  return (
    <tr className="border-t border-border align-top">
      <td className="py-2 pr-2 text-xs text-foreground">{variant.title}</td>
      <td className="py-2 pr-2">
        <Input value={sku} onChange={(e) => setSku(e.target.value)} className="h-7 text-xs font-mono" />
      </td>
      <td className="py-2 pr-2">
        <Input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} className="h-7 text-xs w-24" />
      </td>
      <td className="py-2 pr-2">
        <Input
          type="number"
          min="0"
          step="1"
          placeholder="—"
          value={compareAt}
          onChange={(e) => setCompareAt(e.target.value)}
          className="h-7 text-xs w-24"
        />
      </td>
      <td className="py-2 pr-2">
        <Button size="sm" variant="outline" disabled={!dirty || busy} onClick={saveVariant} className="h-7 text-[11px] px-2">
          Save
        </Button>
      </td>
      <td className="py-2 pr-2 text-xs font-mono text-foreground whitespace-nowrap">{variant.stock}</td>
      <td className="py-2">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            step="1"
            placeholder="+10 / -2"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            className="h-7 text-xs w-20"
          />
          <Button size="sm" variant="outline" disabled={!delta || busy} onClick={applyDelta} className="h-7 text-[11px] px-2">
            Apply
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: MerchantProduct;
  onClose: () => void;
  onSaved: (p: MerchantProduct) => void;
}) {
  const [current, setCurrent] = useState(product);
  const [title, setTitle] = useState(product.title);
  const [slug, setSlug] = useState(product.slug);
  const [description, setDescription] = useState(product.description ?? '');
  const [productType, setProductType] = useState(product.productType ?? '');
  const [vendor, setVendor] = useState(product.vendor ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applyUpdate = (p: MerchantProduct) => {
    setCurrent(p);
    onSaved(p);
    setError(null);
  };

  const saveDetails = async (patch: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      applyUpdate(await updateProduct(current.id, patch));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveDetails({
      title: title.trim(),
      slug: slugify(slug || title),
      description,
      productType: productType.trim() || null,
      vendor: vendor.trim() || null,
    });
  };

  const totalStock = current.variants.reduce((sum, v) => sum + v.stock, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 md:p-10">
      <div className="w-full max-w-4xl rounded-lg border border-border bg-card p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium text-foreground">Edit product</h2>
            <p className="text-xs text-muted-foreground">
              {current.isPublished ? 'Published on the storefront' : 'Hidden from the storefront'} · {totalStock} in stock across{' '}
              {current.variants.length} variant{current.variants.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => saveDetails({ isPublished: !current.isPublished })}
              className="h-8 text-xs"
            >
              {current.isPublished ? 'Unpublish' : 'Publish'}
            </Button>
            <Button size="sm" variant="outline" onClick={onClose} className="h-8 text-xs">
              Close
            </Button>
          </div>
        </div>

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pe-title">Title</Label>
            <Input id="pe-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe-slug">Slug (storefront URL)</Label>
            <Input id="pe-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="pe-desc">Description</Label>
            <Input id="pe-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe-type">Product type</Label>
            <Input id="pe-type" value={productType} onChange={(e) => setProductType(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pe-vendor">Vendor</Label>
            <Input id="pe-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving} className="h-8 text-xs font-normal">
              {saving ? 'Saving...' : 'Save details'}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Variants, prices & stock</h3>
          <p className="text-[11px] text-muted-foreground">
            Prices are in rupees. Stock changes are added or removed (e.g. +20 received, -2 damaged), so a sale at the same
            moment is never overwritten.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-1 pr-2 font-normal">Variant</th>
                  <th className="pb-1 pr-2 font-normal">SKU</th>
                  <th className="pb-1 pr-2 font-normal">Price (Rs)</th>
                  <th className="pb-1 pr-2 font-normal">Compare-at (Rs)</th>
                  <th className="pb-1 pr-2 font-normal" />
                  <th className="pb-1 pr-2 font-normal">Stock</th>
                  <th className="pb-1 font-normal">Adjust</th>
                </tr>
              </thead>
              <tbody>
                {current.variants.map((v) => (
                  <VariantRow key={v.id} productId={current.id} variant={v} onUpdated={applyUpdate} onError={setError} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
