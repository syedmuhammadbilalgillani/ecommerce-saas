'use client';

import React, { useState, useEffect } from 'react';
import {
  getMerchantProducts,
  createMerchantProduct,
  getCategories,
  getCollections,
  formatPrice,
  errorMessage,
  type MerchantProduct,
  type TaxonomyCategory,
  type StoreCollection,
} from '@/lib/api';
import {
  Card,
  Button,
  Input,
  Label,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui';
import { ErrorBanner } from '@/components/error-banner';
import { ProductEditor } from '@/components/product-editor';
import { slugify } from '@/lib/slug';

const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000';

interface DynamicOption {
  name: string;
  valuesInput: string;
  values: string[];
}

interface GeneratedVariant {
  title: string;
  sku: string;
  price: string;
  stock: string;
}

export default function MerchantProductsPage() {
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // New Product Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<MerchantProduct | null>(null);
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [productType, setProductType] = useState('');
  const [vendor, setVendor] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  // Dynamic Shopify-style options (e.g., Size, Color)
  const [options, setOptions] = useState<DynamicOption[]>([
    { name: 'Color', valuesInput: 'Black, White', values: ['Black', 'White'] },
    { name: 'Size', valuesInput: 'M, L', values: ['M', 'L'] },
  ]);

  // Variant Matrix generated dynamically
  const [variantMatrix, setVariantMatrix] = useState<GeneratedVariant[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [prods, cats, cols] = await Promise.all([
          getMerchantProducts(),
          getCategories(),
          getCollections(),
        ]);
        setProducts(prods);
        setCategories(cats);
        setCollections(cols);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Compute Cartesian product of options to build Shopify variant matrix
  useEffect(() => {
    const validOptions = options.filter(o => o.name.trim() && o.values.length > 0);
    if (validOptions.length === 0) {
      setVariantMatrix([
        {
          title: 'Default Title',
          sku: slug ? `${slug.toUpperCase()}-DEF` : 'SKU-DEF',
          price: '2990',
          stock: '50',
        },
      ]);
      return;
    }

    const cartesian = (arrays: string[][]): string[][] => {
      return arrays.reduce<string[][]>(
        (acc, curr) => acc.flatMap(x => curr.map(y => [...x, y])),
        [[]]
      );
    };

    const permutations = cartesian(validOptions.map(o => o.values));
    const baseSkuPrefix = (slug || title || 'PROD').toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 10);

    const generated: GeneratedVariant[] = permutations.map(comb => {
      const comboTitle = comb.join(' / ');
      const skuSuffix = comb.map(c => c.slice(0, 3).toUpperCase()).join('-');
      return {
        title: comboTitle,
        sku: `${baseSkuPrefix}-${skuSuffix}`,
        price: '3490',
        stock: '25',
      };
    });

    setVariantMatrix(generated);
  }, [options, slug, title]);

  const handleOptionNameChange = (idx: number, name: string) => {
    setOptions(prev => {
      const copy = [...prev];
      const current = copy[idx];
      if (current) copy[idx] = { ...current, name };
      return copy;
    });
  };

  const handleOptionValuesChange = (idx: number, valStr: string) => {
    setOptions(prev => {
      const copy = [...prev];
      const parsedValues = valStr.split(',').map(s => s.trim()).filter(Boolean);
      const current = copy[idx];
      if (current) copy[idx] = { ...current, valuesInput: valStr, values: parsedValues };
      return copy;
    });
  };

  const addOptionRow = () => {
    setOptions(prev => [...prev, { name: '', valuesInput: '', values: [] }]);
  };

  const removeOptionRow = (idx: number) => {
    setOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleVariantFieldChange = (idx: number, field: keyof GeneratedVariant, val: string) => {
    setVariantMatrix(prev => {
      const copy = [...prev];
      const current = copy[idx];
      if (current) copy[idx] = { ...current, [field]: val };
      return copy;
    });
  };

  const toggleCollection = (colId: string) => {
    setSelectedCollections(prev =>
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    );
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      slug: slugify(slug || title),
      description,
      categoryId: selectedCategory || null,
      productType: productType || null,
      vendor: vendor || null,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      collectionIds: selectedCollections,
      isPublished: true,
      options: options.filter(o => o.name.trim() && o.values.length > 0).map(o => ({ name: o.name.trim(), values: o.values })),
      variants: variantMatrix.map(v => ({
        title: v.title,
        sku: v.sku,
        priceMinor: Math.round(parseFloat(v.price || '0') * 100),
        stock: parseInt(v.stock || '0', 10),
      })),
    };

    setSaving(true);
    setError(null);
    try {
      const newProd = await createMerchantProduct(payload);
      setProducts(prev => [newProd, ...prev]);
      setIsAddingProduct(false);
      setTitle('');
      setSlug('');
      setSlugEdited(false);
      setDescription('');
    } catch (err) {
      setError(`Could not save product: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-normal tracking-tight text-foreground">Product Catalog</h1>
          <p className="text-xs text-muted-foreground font-normal">
            Shopify-Standard Product Taxonomy, Dynamic Options, and Merchandising Collections.
          </p>
        </div>
        <Button
          onClick={() => setIsAddingProduct(!isAddingProduct)}
          className="text-xs font-normal h-8"
        >
          {isAddingProduct ? 'Close Form' : '+ Add New Product'}
        </Button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Shopify-Style 2-Column Product Creation Studio */}
      {isAddingProduct && (
        <form onSubmit={handleSaveProduct} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Product Information & Variant Permutations */}
            <div className="lg:col-span-2 space-y-5">
              <Card className="p-5 space-y-4">
                <div className="border-b border-border pb-2">
                  <h2 className="text-sm font-medium text-foreground">Basic Information</h2>
                  <p className="text-xs text-muted-foreground">Title, URL slug, and customer-facing description.</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="title">Product Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g. Classic Oxford Cotton Shirt"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (!slugEdited) setSlug(slugify(e.target.value));
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="slug">Slug (Storefront URL)</Label>
                    <Input
                      id="slug"
                      placeholder="classic-oxford-cotton-shirt"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value);
                        setSlugEdited(e.target.value !== '');
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="desc">Description</Label>
                    <Input
                      id="desc"
                      placeholder="High-density combed yarn, breathable weave, button-down collar..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
              </Card>

              {/* Dynamic Options Section */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Options & Attributes</h3>
                    <p className="text-xs text-muted-foreground">Dimensions like Size, Color, or Material (comma separated).</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOptionRow}
                    className="text-[11px] h-7 px-2.5 font-normal"
                  >
                    + Add Option
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-muted/40 p-2.5 rounded-md border border-border">
                      <div className="w-1/3 space-y-1">
                        <Label className="text-[10px]">Option Name</Label>
                        <Input
                          placeholder="e.g. Size"
                          value={opt.name}
                          onChange={(e) => handleOptionNameChange(idx, e.target.value)}
                          className="h-8 text-xs bg-card"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-[10px]">Values (Comma separated)</Label>
                        <Input
                          placeholder="e.g. S, M, L, XL"
                          value={opt.valuesInput}
                          onChange={(e) => handleOptionValuesChange(idx, e.target.value)}
                          className="h-8 text-xs bg-card"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOptionRow(idx)}
                        className="text-muted-foreground hover:text-foreground text-xs px-2 pt-4 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Variants Matrix */}
              <Card className="p-5 space-y-3">
                <div className="border-b border-border pb-2">
                  <h3 className="text-sm font-medium text-foreground">
                    Variants Matrix ({variantMatrix.length} Permutations Generated)
                  </h3>
                  <p className="text-xs text-muted-foreground">Each SKU has its individual inventory count and PKR price.</p>
                </div>

                <div className="rounded-md border border-border overflow-hidden bg-card">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Variant</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="w-[110px]">Price (PKR)</TableHead>
                        <TableHead className="w-[90px]">Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variantMatrix.map((variant, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-normal text-foreground">
                            {variant.title}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={variant.sku}
                              onChange={(e) => handleVariantFieldChange(idx, 'sku', e.target.value)}
                              className="h-7 text-xs font-mono bg-card"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={variant.price}
                              onChange={(e) => handleVariantFieldChange(idx, 'price', e.target.value)}
                              className="h-7 text-xs font-mono bg-card"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={variant.stock}
                              onChange={(e) => handleVariantFieldChange(idx, 'stock', e.target.value)}
                              className="h-7 text-xs font-mono bg-card"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>

            {/* Right Column: Shopify-Style Organization & Taxonomy */}
            <div className="space-y-5">
              {/* Standard Taxonomy Category */}
              <Card className="p-4 space-y-3">
                <div>
                  <h3 className="text-xs font-medium text-foreground uppercase tracking-wider">Product Category</h3>
                  <p className="text-[11px] text-muted-foreground">Shopify Standard Global Taxonomy (1 Category)</p>
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full h-8 rounded bg-card border border-border text-xs text-foreground px-2 focus:outline-none"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.fullName.split('>')[0]?.trim() || c.name})
                    </option>
                  ))}
                </select>

                <div className="p-2 rounded bg-muted/50 border border-border text-[10px] text-muted-foreground">
                  <span>Taxonomy Path: </span>
                  <span className="text-foreground">
                    {categories.find(c => c.id === selectedCategory)?.fullName || 'Selected'}
                  </span>
                </div>
              </Card>

              {/* Collections Multi-Select */}
              <Card className="p-4 space-y-3">
                <div>
                  <h3 className="text-xs font-medium text-foreground uppercase tracking-wider">Collections</h3>
                  <p className="text-[11px] text-muted-foreground">Storefront merchandising (Multi-assignment)</p>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {collections.map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/60 cursor-pointer text-xs text-foreground select-none"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCollections.includes(col.id)}
                        onChange={() => toggleCollection(col.id)}
                        className="rounded border-border text-primary focus:ring-0"
                      />
                      <span>{col.title}</span>
                    </label>
                  ))}
                </div>
              </Card>

              {/* Product Organization: Vendor & Tags */}
              <Card className="p-4 space-y-3">
                <div>
                  <h3 className="text-xs font-medium text-foreground uppercase tracking-wider">Organization</h3>
                  <p className="text-[11px] text-muted-foreground">Vendor, product type, and search tags</p>
                </div>

                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Product Type</Label>
                    <Input
                      value={productType}
                      onChange={(e) => setProductType(e.target.value)}
                      placeholder="e.g. T-Shirt"
                      className="h-7 text-xs bg-card"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px]">Vendor / Brand</Label>
                    <Input
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      placeholder="e.g. Your brand name"
                      className="h-7 text-xs bg-card"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px]">Tags (Comma separated)</Label>
                    <Input
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="cotton, summer, premium"
                      className="h-7 text-xs bg-card"
                    />
                  </div>
                </div>
              </Card>

              {/* Publish Action Button */}
              <div className="pt-2">
                <Button type="submit" disabled={saving} className="w-full text-xs font-normal h-9">
                  {saving ? 'Publishing...' : 'Publish Product to Storefront'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Existing Products List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Catalog Inventory ({products.length} Products)</h2>
        </div>

        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category (Taxonomy)</TableHead>
                <TableHead>Type & Vendor</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Inventory</TableHead>
                <TableHead>Price Range</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                    Loading catalog...
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                    No products added yet. Click &quot;+ Add New Product&quot; to create one.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => {
                  const totalStock = p.variants.reduce((acc, v) => acc + (v.stock || 0), 0);
                  const minPrice = Math.min(...p.variants.map(v => v.priceMinor || 0));
                  const maxPrice = Math.max(...p.variants.map(v => v.priceMinor || 0));
                  const priceStr = minPrice === maxPrice
                    ? formatPrice(minPrice)
                    : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;

                  const catDisplay = p.category?.name || categories.find(c => c.id === p.categoryId)?.name || 'Uncategorized';

                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="text-xs font-normal text-foreground">{p.title}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">/{p.slug}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {catDisplay}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="text-foreground">{p.productType || '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{p.vendor || '—'}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.variants.length} variants
                      </TableCell>
                      <TableCell className="text-xs font-mono text-foreground">
                        {totalStock} in stock
                      </TableCell>
                      <TableCell className="text-xs font-mono text-foreground">
                        {priceStr}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(p)}
                            className="h-7 text-[11px] px-2 font-normal"
                          >
                            Edit
                          </Button>
                          {p.isPublished ? (
                            <a
                              href={`${STOREFRONT_URL}/products/${p.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded bg-secondary border border-border transition-colors"
                            >
                              Live ↗
                            </a>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Hidden</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => setProducts(prev => prev.map(x => (x.id === updated.id ? updated : x)))}
        />
      )}
    </div>
  );
}
