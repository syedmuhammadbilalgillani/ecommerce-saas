/**
 * One canonical form per phone so the same shopper isn't split into several customers:
 * Pakistani mobiles (03xx…, 923xx…, +923xx…) become +923xxxxxxxxx; anything else keeps +digits.
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  if (/^03\d{9}$/.test(digits)) return `+92${digits.slice(1)}`;
  if (/^923\d{9}$/.test(digits)) return `+${digits}`;
  return cleaned.startsWith('+') ? `+${digits}` : digits;
}
