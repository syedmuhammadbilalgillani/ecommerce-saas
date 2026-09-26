import { Inject, Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { resolveTenantId, type DbExecutor } from '../db/store-context';
import { type Database, discounts, eq, and, or, lt, lte, gt, ne, isNull, sql } from '@repo/db';

type DiscountRow = typeof discounts.$inferSelect;

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
    const { discountAmountMinor, freeShipping } = this.computeAmount(discount, subtotalMinor);

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

  async setActive(storeId: string, discountId: string, isActive: unknown) {
    if (typeof isActive !== 'boolean') {
      throw new BadRequestException('isActive must be true or false');
    }
    const [updated] = await this.db
      .update(discounts)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(discounts.id, discountId), eq(discounts.storeId, storeId)))
      .returning();
    if (!updated) throw new NotFoundException('Discount not found');
    return updated;
  }

  /**
   * Checkout-time redemption. Checks every rule AND increments times_used in one UPDATE,
   * so concurrent checkouts can never push a code past its usage limit.
   * Must run inside the checkout transaction so a failed order rolls the usage back.
   */
  async redeem(
    executor: DbExecutor,
    rawCode: string,
    storeId: string,
    subtotalMinor: number
  ): Promise<{ code: string; discountAmountMinor: number; freeShipping: boolean }> {
    const code = (rawCode || '').trim().toUpperCase();
    const now = new Date();

    const [redeemed] = await executor
      .update(discounts)
      .set({ timesUsed: sql`${discounts.timesUsed} + 1`, updatedAt: now })
      .where(
        and(
          eq(discounts.storeId, storeId),
          eq(sql`UPPER(${discounts.code})`, code),
          eq(discounts.isActive, true),
          lte(discounts.startsAt, now),
          or(isNull(discounts.endsAt), gt(discounts.endsAt, now)),
          or(isNull(discounts.usageLimit), lt(discounts.timesUsed, discounts.usageLimit)),
          or(ne(discounts.minRequirementType, 'min_subtotal'), lte(discounts.minSubtotalMinor, subtotalMinor))
        )
      )
      .returning();

    if (!redeemed) {
      // Re-run the read-only checks purely to give the shopper the specific reason.
      await this.validateDiscount(code, subtotalMinor, storeId);
      throw new ConflictException(`Promo code "${code}" is no longer available.`);
    }

    return { code: redeemed.code, ...this.computeAmount(redeemed, subtotalMinor) };
  }

  private computeAmount(discount: DiscountRow, subtotalMinor: number) {
    if (discount.discountType === 'percentage') {
      return { discountAmountMinor: Math.round((subtotalMinor * discount.value) / 100), freeShipping: false };
    }
    if (discount.discountType === 'fixed_amount') {
      return { discountAmountMinor: Math.min(discount.value, subtotalMinor), freeShipping: false };
    }
    return { discountAmountMinor: 0, freeShipping: discount.discountType === 'free_shipping' };
  }
}
