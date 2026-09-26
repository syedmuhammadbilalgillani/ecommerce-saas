import { BadRequestException } from '@nestjs/common';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function parseLimit(raw: unknown): number {
  if (raw === undefined || raw === '') return DEFAULT_PAGE_SIZE;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_SIZE) {
    throw new BadRequestException(`limit must be between 1 and ${MAX_PAGE_SIZE}`);
  }
  return n;
}

/**
 * Opaque keyset cursor: the sort value and id of the last row on the previous page.
 * Keyset (not OFFSET) pagination stays fast and never skips/duplicates rows when new orders arrive.
 */
export function encodeCursor(sortValue: string | number, id: string): string {
  return Buffer.from(JSON.stringify([sortValue, id])).toString('base64url');
}

export function decodeCursor(raw: unknown): { sortValue: string | number; id: string } | null {
  if (raw === undefined || raw === '') return null;
  try {
    const [sortValue, id] = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
    if ((typeof sortValue === 'string' || typeof sortValue === 'number') && typeof id === 'string') {
      return { sortValue, id };
    }
  } catch {
    // fall through
  }
  throw new BadRequestException('Invalid cursor');
}

/** Escapes % and _ so user search text is matched literally inside ILIKE. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
