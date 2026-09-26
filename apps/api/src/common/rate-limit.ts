import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';

interface RateLimitRule {
  /** Max requests per window, per client IP, for this route. */
  limit: number;
  windowSeconds: number;
}

const RATE_LIMIT_KEY = 'posflow:rate-limit';

/** Tighter per-route limit, e.g. @RateLimit(10, 60) = 10 requests per minute per IP. */
export const RateLimit = (limit: number, windowSeconds = 60) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowSeconds } satisfies RateLimitRule);

/** Applied to every route unless a route declares its own @RateLimit. */
const DEFAULT_RULE: RateLimitRule = {
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE) || 300,
  windowSeconds: 60,
};

/**
 * Fixed-window, per-IP rate limiting held in memory.
 * Good for a single API instance; with several instances behind a load balancer each keeps
 * its own counters, so move this to Redis when scaling out.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = Date.now();

  constructor(private readonly reflector: Reflector) {}

  // For the automated test suite, which fires many checkouts from one IP. Never honored in production.
  private readonly disabled =
    process.env.RATE_LIMIT_DISABLED === 'true' && process.env.NODE_ENV !== 'production';

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http' || this.disabled) return true;
    const http = context.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const custom = this.reflector.getAllAndOverride<RateLimitRule | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const rule = custom ?? DEFAULT_RULE;
    const scope = custom ? `${context.getClass().name}.${context.getHandler().name}` : 'global';
    const key = `${req.ip}|${scope}`;

    const now = Date.now();
    this.sweep(now);

    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + rule.windowSeconds * 1000 };
      this.hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > rule.limit) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      reply.header('Retry-After', String(retryAfter));
      throw new HttpException(
        `Too many requests. Please wait ${retryAfter} seconds and try again.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    return true;
  }

  /** Drop expired windows once a minute so the map can't grow without bound. */
  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key);
    }
  }
}
