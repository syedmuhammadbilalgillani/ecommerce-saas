export interface DiscountRule {
  discountType: string; // 'percentage' | 'fixed_amount' | 'free_shipping'
  value: number; // percentage points, or minor units for fixed_amount
}

/** Discount for a subtotal, in integer minor units. Never more than the subtotal. */
export function computeDiscount(rule: DiscountRule, subtotalMinor: number) {
  if (rule.discountType === 'percentage') {
    return { discountAmountMinor: Math.round((subtotalMinor * rule.value) / 100), freeShipping: false };
  }
  if (rule.discountType === 'fixed_amount') {
    return { discountAmountMinor: Math.min(rule.value, subtotalMinor), freeShipping: false };
  }
  return { discountAmountMinor: 0, freeShipping: rule.discountType === 'free_shipping' };
}
