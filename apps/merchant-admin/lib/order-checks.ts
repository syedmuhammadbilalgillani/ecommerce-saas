/**
 * Plain, explainable COD checks computed from the order itself — no invented scores.
 */

/** Pakistani mobile numbers: 03XXXXXXXXX, 923XXXXXXXXX or +923XXXXXXXXX. */
export function isPakistaniMobile(phone: string): boolean {
  const digits = phone.replace(/[^\d+]/g, '');
  return /^(?:\+?92|0)3\d{9}$/.test(digits);
}

const MAJOR_METROS = new Set([
  'karachi',
  'lahore',
  'islamabad',
  'rawalpindi',
  'faisalabad',
  'multan',
  'peshawar',
  'hyderabad',
  'gujranwala',
  'quetta',
]);

export function isMajorMetro(city: string): boolean {
  return MAJOR_METROS.has(city.trim().toLowerCase());
}

export const FULFILLMENT_LABEL: Record<string, string> = {
  pending: 'Awaiting dispatch',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};
