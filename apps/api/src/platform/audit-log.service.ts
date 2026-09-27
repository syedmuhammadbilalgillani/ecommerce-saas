import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { type Database, auditLogs, desc, eq, and, type SQL } from '@repo/db';
import { randomBytes } from 'node:crypto';

export interface CreateAuditLogDto {
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async log(dto: CreateAuditLogDto) {
    try {
      await this.db.insert(auditLogs).values({
        id: `audit_${randomBytes(12).toString('hex')}`,
        actorId: dto.actorId,
        actorEmail: dto.actorEmail,
        actorRole: dto.actorRole,
        action: dto.action,
        targetType: dto.targetType,
        targetId: dto.targetId,
        metadata: dto.metadata ?? null,
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  async list(options?: { limit?: number; action?: string; targetType?: string }) {
    const limit = Math.min(options?.limit ?? 50, 100);
    const conditions: SQL[] = [];
    if (options?.action) conditions.push(eq(auditLogs.action, options.action));
    if (options?.targetType) conditions.push(eq(auditLogs.targetType, options.targetType));

    const rows = await this.db.query.auditLogs.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(auditLogs.createdAt)],
      limit,
    });

    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
