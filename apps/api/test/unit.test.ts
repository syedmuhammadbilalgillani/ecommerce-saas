// Fast tests for pure business rules. No database, no server.  Run: pnpm --filter api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from '../src/customers/phone.ts';
import { computeDiscount } from '../src/discounts/discount-math.ts';
import { decodeCursor, encodeCursor, likePattern, parseLimit } from '../src/common/pagination.ts';

test('normalizePhone: every Pakistani mobile format becomes one canonical +923… form', () => {
  for (const input of ['03001234567', '0300-1234567', '0300 123 4567', '923001234567', '+923001234567', '+92 300 1234567']) {
    assert.equal(normalizePhone(input), '+923001234567', input);
  }
});

test('normalizePhone: foreign numbers keep their country code', () => {
  assert.equal(normalizePhone('+1 (848) 179-7323'), '+18481797323');
  assert.equal(normalizePhone('+971 50 123 4567'), '+971501234567');
});

test('computeDiscount: percentage is rounded to whole minor units', () => {
  assert.deepEqual(computeDiscount({ discountType: 'percentage', value: 10 }, 249000), {
    discountAmountMinor: 24900,
    freeShipping: false,
  });
  assert.equal(computeDiscount({ discountType: 'percentage', value: 15 }, 333).discountAmountMinor, 50);
});

test('computeDiscount: a fixed amount never exceeds the subtotal', () => {
  assert.equal(computeDiscount({ discountType: 'fixed_amount', value: 50000 }, 300000).discountAmountMinor, 50000);
  assert.equal(computeDiscount({ discountType: 'fixed_amount', value: 50000 }, 20000).discountAmountMinor, 20000);
});

test('computeDiscount: free shipping gives no money off, only the flag', () => {
  assert.deepEqual(computeDiscount({ discountType: 'free_shipping', value: 0 }, 250000), {
    discountAmountMinor: 0,
    freeShipping: true,
  });
});

test('pagination cursor round-trips and rejects garbage', () => {
  const cursor = encodeCursor('2026-09-27T10:00:00.000Z', 'ord_abc');
  assert.deepEqual(decodeCursor(cursor), { sortValue: '2026-09-27T10:00:00.000Z', id: 'ord_abc' });
  assert.equal(decodeCursor(undefined), null);
  assert.throws(() => decodeCursor('not-a-cursor'));
});

test('parseLimit enforces 1..200 with a default of 50', () => {
  assert.equal(parseLimit(undefined), 50);
  assert.equal(parseLimit('25'), 25);
  assert.throws(() => parseLimit('0'));
  assert.throws(() => parseLimit('500'));
  assert.throws(() => parseLimit('abc'));
});

test('likePattern matches user text literally inside ILIKE', () => {
  assert.equal(likePattern('50%_off'), '%50\\%\\_off%');
});
