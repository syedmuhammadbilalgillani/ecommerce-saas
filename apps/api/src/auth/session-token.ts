import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

export type Role = 'merchant' | 'platform_admin';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Separate cookies so a merchant and a platform admin session never overwrite each other. */
export const SESSION_COOKIE: Record<Role, string> = {
  merchant: 'posflow_merchant_session',
  platform_admin: 'posflow_platform_session',
};

export function newSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Only this hash is stored, so a database leak does not expose usable tokens. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[key] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

/** Reads the session token from the role's cookie, or an `Authorization: Bearer` header. */
export function readSessionToken(req: FastifyRequest, role: Role): string | null {
  const cookieToken = parseCookies(req.headers.cookie)[SESSION_COOKIE[role]];
  if (cookieToken) return cookieToken;

  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim() || null;
  return null;
}

function cookieAttributes(maxAgeSeconds: number): string {
  const parts = [`Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=${maxAgeSeconds}`];
  if (process.env.COOKIE_DOMAIN) parts.push(`Domain=${process.env.COOKIE_DOMAIN}`);
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function setSessionCookie(reply: FastifyReply, role: Role, token: string) {
  reply.header(
    'Set-Cookie',
    `${SESSION_COOKIE[role]}=${encodeURIComponent(token)}; ${cookieAttributes(Math.floor(SESSION_TTL_MS / 1000))}`
  );
}

export function clearSessionCookie(reply: FastifyReply, role: Role) {
  reply.header('Set-Cookie', `${SESSION_COOKIE[role]}=; ${cookieAttributes(0)}`);
}
