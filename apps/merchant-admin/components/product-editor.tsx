'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  adjustStock,
  errorMessage,
  setProductImages,
  updateProduct,
  updateVariant,
  type MerchantProduct,
  type MerchantProductImage,
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
  const [option1, setOption1] = useState(variant.option1 ?? '');
  const [option2, setOption2] = useState(variant.option2 ?? '');
  const [option3, setOption3] = useState(variant.option3 ?? '');
  const [delta, setDelta] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty =
    sku !== variant.sku ||
    toMinor(price) !== variant.priceMinor ||
    (compareAt === '' ? null : toMinor(compareAt)) !== (variant.compareAtPriceMinor ?? null) ||
    option1.trim() !== (variant.option1 ?? '') ||
    option2.trim() !== (variant.option2 ?? '') ||
    option3.trim() !== (variant.option3 ?? '');

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
        option1: option1.trim() || null,
        option2: option2.trim() || null,
        option3: option3.trim() || null,
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
        <Input placeholder="Option 1" value={option1} onChange={(e) => setOption1(e.target.value)} className="h-7 text-xs w-20" />
      </td>
      <td className="py-2 pr-2">
        <Input placeholder="Option 2" value={option2} onChange={(e) => setOption2(e.target.value)} className="h-7 text-xs w-20" />
      </td>
      <td className="py-2 pr-2">
        <Input placeholder="Option 3" value={option3} onChange={(e) => setOption3(e.target.value)} className="h-7 text-xs w-20" />
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

interface ImageDraft {
  url: string;
  altText: string;
}

function ImagesEditor({
  productId,
  images,
  onUpdated,
  onError,
}: {
  productId: string;
  images: MerchantProductImage[];
  onUpdated: (p: MerchantProduct) => void;
  onError: (msg: string) => void;
}) {
  const [drafts, setDrafts] = useState<ImageDraft[]>(
    images.map((img) => ({ url: img.url, altText: img.altText ?? '' }))
  );
  const [busy, setBusy] = useState(false);

  const dirty =
    drafts.length !== images.length ||
    drafts.some((d, i) => d.url !== images[i]?.url || d.altText !== (images[i]?.altText ?? ''));

  const updateDraft = (idx: number, field: keyof ImageDraft, value: string) => {
    setDrafts((prev) => {
      const copy = [...prev];
      const current = copy[idx];
      if (current) copy[idx] = { ...current, [field]: value };
      return copy;
    });
  };

  const addRow = () => setDrafts((prev) => [...prev, { url: '', altText: '' }]);
  const removeRow = (idx: number) => setDrafts((prev) => prev.filter((_, i) => i !== idx));

  const save = async () => {
    setBusy(true);
    try {
      const payload = drafts
        .map((d) => ({ url: d.url.trim(), altText: d.altText.trim() || null }))
        .filter((d) => d.url);
      onUpdated(await setProductImages(productId, payload));
    } catch (err) {
      onError(`Images: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">Product images</h3>
      <p className="text-[11px] text-muted-foreground">
        Image URLs, shown on the storefront in this order. The first image is the primary product photo.
      </p>
      <div className="space-y-2">
        {drafts.map((d, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              placeholder="https://..."
              value={d.url}
              onChange={(e) => updateDraft(idx, 'url', e.target.value)}
              className="h-8 text-xs flex-1"
            />
            <Input
              placeholder="Alt text (optional)"
              value={d.altText}
              onChange={(e) => updateDraft(idx, 'altText', e.target.value)}
              className="h-8 text-xs w-48"
            />
            <button
              type="button"
              onClick={() => removeRow(idx)}
              className="text-muted-foreground hover:text-foreground px-1.5 cursor-pointer"
              title="Remove image"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" onClick={addRow} className="h-7 text-[11px] px-2">
          Add image
        </Button>
        <Button type="button" size="sm" disabled={!dirty || busy} onClick={save} className="h-7 text-[11px] px-2">
          {busy ? 'Saving...' : 'Save images'}
        </Button>
      </div>
    </div>
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
                  <th className="pb-1 pr-2 font-normal">Option 1</th>
                  <th className="pb-1 pr-2 font-normal">Option 2</th>
                  <th className="pb-1 pr-2 font-normal">Option 3</th>
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

        <ImagesEditor productId={current.id} images={current.images} onUpdated={applyUpdate} onError={setError} />
      </div>
    </div>
  );
}
