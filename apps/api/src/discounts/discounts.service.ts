import { Inject, Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { resolveTenantId, type DbExecutor } from '../db/store-context';
import { type Database, discounts, eq, and, sql } from '@repo/db';

export interface ValidateDiscountResult {
  valid: boolean;
  code: string;
  discountType: string;
  value: number;
  discountAmountMinor: number;
  freeShipping: boolean;
  message: string;
}

export interface CreateDiscountDto {
  code: string;
  title: string;
  description?: string;
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping';
  value: number;
  appliesTo?: string;
  minRequirementType?: 'none' | 'min_subtotal' | 'min_quantity';
  minSubtotalMinor?: number;
  usageLimit?: number;
  endsAt?: string;
  isActive?: boolean;
}

@Injectable()
export class DiscountsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  }

  async validateDiscount(
    rawCode: string,
    subtotalMinor: number,
    storeId: string
  ): Promise<ValidateDiscountResult> {
    if (!rawCode) {
      throw new BadRequestException('Discount code is required');
    }

    const code = rawCode.trim().toUpperCase();

    // Query discount by code
    const results = await this.db
      .select()
      .from(discounts)
      .where(
        and(
          eq(discounts.storeId, storeId),
          eq(sql`UPPER(${discounts.code})`, code),
          eq(discounts.isActive, true)
        )
      )
      .limit(1);

    if (!results || results.length === 0) {
      throw new NotFoundException(`Coupon code "${code}" is invalid or expired.`);
    }

    const discount = results[0];
    const now = new Date();

    // 1. Time validity
    if (discount.startsAt && new Date(discount.startsAt) > now) {
      throw new BadRequestException(`Promo code "${code}" is not active yet.`);
    }
    if (discount.endsAt && new Date(discount.endsAt) < now) {
      throw new BadRequestException(`Promo code "${code}" has expired.`);
    }

    // 2. Usage limit
    if (discount.usageLimit !== null && discount.timesUsed >= discount.usageLimit) {
      throw new BadRequestException(`Promo code "${code}" usage limit has been reached.`);
    }

    // 3. Minimum requirement
    if (discount.minRequirementType === 'min_subtotal' && subtotalMinor < discount.minSubtotalMinor) {
      const minPkr = Math.round(discount.minSubtotalMinor / 100);
      throw new BadRequestException(
        `Promo code "${code}" requires a minimum order total of Rs. ${minPkr.toLocaleString()}.`
      );
    }

    // 4. Calculate discount amount in minor units
    let discountAmountMinor = 0;
    let freeShipping = false;

    if (discount.discountType === 'percentage') {
      discountAmountMinor = Math.round((subtotalMinor * discount.value) / 100);
    } else if (discount.discountType === 'fixed_amount') {
      discountAmountMinor = Math.min(discount.value, subtotalMinor);
    } else if (discount.discountType === 'free_shipping') {
      freeShipping = true;
      discountAmountMinor = 0;
    }

    return {
      valid: true,
      code: discount.code,
      discountType: discount.discountType,
      value: discount.value,
      discountAmountMinor,
      freeShipping,
      message: `${discount.title} applied successfully!`,
    };
  }

  async getStoreDiscounts(storeId: string) {
    const list = await this.db
      .select()
      .from(discounts)
      .where(eq(discounts.storeId, storeId))
      .orderBy(sql`${discounts.createdAt} DESC`);

    return list;
  }

  async createDiscount(
    dto: CreateDiscountDto,
    storeId: string
  ) {
    if (!dto.code || !dto.title || dto.value === undefined) {
      throw new BadRequestException('Code, Title, and Value are required');
    }

    const value = Number(dto.value);
    if (dto.discountType === 'percentage') {
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        throw new BadRequestException('Percentage discounts must be a whole number between 1 and 100');
      }
    } else if (dto.discountType === 'fixed_amount') {
      if (!Number.isInteger(value) || value < 1) {
        throw new BadRequestException('Fixed discounts must be a positive amount in minor units');
      }
    } else if (dto.discountType !== 'free_shipping') {
      throw new BadRequestException('discountType must be percentage, fixed_amount or free_shipping');
    }

    const code = dto.code.trim().toUpperCase();
    const tenantId = await resolveTenantId(this.db, storeId);

    const existing = await this.db
      .select({ id: discounts.id })
      .from(discounts)
      .where(and(eq(discounts.storeId, storeId), eq(sql`UPPER(${discounts.code})`, code)))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException(`Discount code "${code}" already exists in this store`);
    }

    const id = this.generateId('disc');

    const created = await this.db
      .insert(discounts)
      .values({
        id,
        tenantId,
        storeId,
        code,
        title: dto.title.trim(),
        description: dto.description || null,
        discountType: dto.discountType,
        value: dto.discountType === 'free_shipping' ? 0 : value,
        appliesTo: dto.appliesTo || 'all_products',
        minRequirementType: dto.minRequirementType || 'none',
        minSubtotalMinor: dto.minSubtotalMinor ? Number(dto.minSubtotalMinor) : 0,
        usageLimit: dto.usageLimit ? Number(dto.usageLimit) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      } as any)
      .returning();

    return created[0];
  }

  async incrementUsage(code: string, storeId: string, executor: DbExecutor = this.db) {
    await executor
      .update(discounts)
      .set({
        timesUsed: sql`${discounts.timesUsed} + 1`,
      } as any)
      .where(and(eq(discounts.storeId, storeId), eq(sql`UPPER(${discounts.code})`, code.toUpperCase())));
  }
}
