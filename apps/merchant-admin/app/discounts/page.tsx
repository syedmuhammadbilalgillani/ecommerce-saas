'use client';

import React, { useState, useEffect } from 'react';
import { getDiscounts, createDiscount, setDiscountActive, formatPrice, errorMessage, type MerchantDiscount } from '@/lib/api';
import { ErrorBanner } from '@/components/error-banner';
import {
  Card,
  CardContent,
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

export default function MerchantDiscountsPage() {
  const [discounts, setDiscounts] = useState<MerchantDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount' | 'free_shipping'>('percentage');
  const [value, setValue] = useState('10');
  const [minRequirementType, setMinRequirementType] = useState<'none' | 'min_subtotal'>('none');
  const [minSubtotal, setMinSubtotal] = useState('2000');
  const [usageLimit, setUsageLimit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggle = async (discount: MerchantDiscount) => {
    setTogglingId(discount.id);
    setError(null);
    try {
      const updated = await setDiscountActive(discount.id, !discount.isActive);
      setDiscounts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err) {
      setError(`Could not update ${discount.code}: ${errorMessage(err)}`);
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        setDiscounts(await getDiscounts());
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !title) return;

    // Convert value to minor units if fixed_amount
    const numericVal = parseFloat(value) || 0;
    const finalValue = discountType === 'fixed_amount' ? Math.round(numericVal * 100) : numericVal;
    const finalMinSubtotalMinor = minRequirementType === 'min_subtotal' ? Math.round((parseFloat(minSubtotal) || 0) * 100) : 0;

    const payload = {
      code: code.trim().toUpperCase(),
      title: title.trim(),
      description: description.trim() || undefined,
      discountType,
      value: finalValue,
      minRequirementType,
      minSubtotalMinor: finalMinSubtotalMinor,
      usageLimit: usageLimit ? parseInt(usageLimit, 10) : undefined,
      isActive: true,
    };

    setSaving(true);
    setError(null);
    try {
      const created = await createDiscount(payload);
      setDiscounts((prev) => [created, ...prev]);
      setIsCreating(false);
      setCode('');
      setTitle('');
      setDescription('');
      setValue('10');
      setUsageLimit('');
    } catch (err) {
      setError(`Could not create discount: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-normal tracking-tight text-foreground">Discount Engine</h1>
          <p className="text-xs text-muted-foreground font-normal">
            Shopify-standard promotion rules, automatic coupons, and minimum order requirements.
          </p>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          className="text-xs font-normal h-8"
        >
          {isCreating ? 'Close Form' : '+ Create Discount'}
        </Button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Shopify-Style 2-Column Discount Studio */}
      {isCreating && (
        <form onSubmit={handleCreate} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Basic Rule Info */}
            <div className="lg:col-span-2 space-y-5">
              <Card className="p-5 space-y-4">
                <div className="border-b border-border pb-2">
                  <h2 className="text-sm font-medium text-foreground">Discount Information</h2>
                  <p className="text-xs text-muted-foreground">Promotion code, customer title, and discount type.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="code">Coupon Code</Label>
                    <Input
                      id="code"
                      placeholder="e.g. SUMMER25"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">Customers enter this code at checkout.</p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="title">Display Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g. 15% Summer Sale"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="desc">Description (Optional)</Label>
                  <Input
                    id="desc"
                    placeholder="e.g. Valid on all summer collection pieces"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* Type Selection */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Label>Discount Type & Value</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      className={`p-3 rounded-md border text-left text-xs transition-colors ${
                        discountType === 'percentage'
                          ? 'border-foreground bg-secondary font-medium'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="font-medium text-foreground">Percentage</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">% off cart items</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed_amount')}
                      className={`p-3 rounded-md border text-left text-xs transition-colors ${
                        discountType === 'fixed_amount'
                          ? 'border-foreground bg-secondary font-medium'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="font-medium text-foreground">Fixed Amount</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Rs. off total cart</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDiscountType('free_shipping')}
                      className={`p-3 rounded-md border text-left text-xs transition-colors ${
                        discountType === 'free_shipping'
                          ? 'border-foreground bg-secondary font-medium'
                          : 'border-border bg-card text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="font-medium text-foreground">Free Shipping</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Free courier delivery</div>
                    </button>
                  </div>

                  {discountType !== 'free_shipping' && (
                    <div className="pt-2 max-w-xs space-y-1">
                      <Label htmlFor="val">
                        {discountType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount (PKR)'}
                      </Label>
                      <Input
                        id="val"
                        type="number"
                        min="1"
                        placeholder={discountType === 'percentage' ? '15' : '500'}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right Column: Conditions & Usage Limits */}
            <div className="space-y-5">
              <Card className="p-5 space-y-4">
                <div className="border-b border-border pb-2">
                  <h2 className="text-sm font-medium text-foreground">Minimum Requirements</h2>
                  <p className="text-xs text-muted-foreground">Order qualifiers for discount activation.</p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="minReq"
                      checked={minRequirementType === 'none'}
                      onChange={() => setMinRequirementType('none')}
                      className="accent-emerald-500"
                    />
                    <span>No minimum requirement</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="minReq"
                      checked={minRequirementType === 'min_subtotal'}
                      onChange={() => setMinRequirementType('min_subtotal')}
                      className="accent-emerald-500"
                    />
                    <span>Minimum purchase amount (PKR)</span>
                  </label>

                  {minRequirementType === 'min_subtotal' && (
                    <div className="pl-6 space-y-1">
                      <Input
                        type="number"
                        placeholder="2500"
                        value={minSubtotal}
                        onChange={(e) => setMinSubtotal(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">Applies only if cart total exceeds this value.</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border space-y-2">
                  <Label htmlFor="usage">Total Usage Limit (Optional)</Label>
                  <Input
                    id="usage"
                    type="number"
                    placeholder="e.g. 500"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Limit number of times code can be redeemed.</p>
                </div>

                <div className="pt-3 border-t border-border flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreating(false)}
                    className="text-xs font-normal h-8"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving} className="text-xs font-normal h-8">
                    Save Discount Rule
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </form>
      )}

      {/* Discounts Directory Table */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type & Value</TableHead>
              <TableHead>Min. Order</TableHead>
              <TableHead>Redemptions</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                  Loading active discount promotions...
                </TableCell>
              </TableRow>
            ) : discounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                  No discount codes created yet. Click "+ Create Discount" to add your first promotion.
                </TableCell>
              </TableRow>
            ) : (
              discounts.map((disc) => (
                <TableRow key={disc.id}>
                  <TableCell className="font-mono font-medium text-xs text-foreground">
                    <span className="px-2 py-0.5 rounded bg-muted border border-border">
                      {disc.code}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-foreground font-normal">{disc.title}</div>
                    {disc.description && (
                      <div className="text-[10px] text-muted-foreground">{disc.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {disc.discountType === 'percentage' && `${disc.value}% OFF`}
                    {disc.discountType === 'fixed_amount' && `${formatPrice(disc.value)} OFF`}
                    {disc.discountType === 'free_shipping' && 'Free Courier Delivery'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {disc.minRequirementType === 'min_subtotal' && disc.minSubtotalMinor > 0
                      ? formatPrice(disc.minSubtotalMinor)
                      : 'None'}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {disc.timesUsed} {disc.usageLimit ? `/ ${disc.usageLimit}` : 'uses'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant={disc.isActive ? 'success' : 'default'} className="text-[10px]">
                        {disc.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={togglingId === disc.id}
                        onClick={() => handleToggle(disc)}
                        className="h-6 text-[10px] px-2 font-normal"
                      >
                        {disc.isActive ? 'Turn off' : 'Turn on'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
