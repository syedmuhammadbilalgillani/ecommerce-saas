import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DRIZZLE } from './db/db.module';
import { type Database, sql } from '@repo/db';

@Controller()
export class AppController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Liveness: the process is up. Cheap, no dependencies — for load balancer pings. */
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /** Readiness: the API can actually serve traffic (database reachable). Returns 503 if not. */
  @Get('health/ready')
  async readiness() {
    const started = Date.now();
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      throw new ServiceUnavailableException({ status: 'unavailable', database: 'unreachable' });
    }
    return { status: 'ok', database: 'ok', databaseLatencyMs: Date.now() - started };
  }
}
