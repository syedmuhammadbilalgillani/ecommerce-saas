import { Controller, Post, Get, Patch, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { DiscountsService, CreateDiscountDto } from './discounts.service';
import {
  CurrentMerchant,
  MerchantGuard,
  StorefrontStore,
  StorefrontStoreGuard,
  type MerchantContext,
} from '../auth/guards';
import { RateLimit } from '../common/rate-limit';

@Controller('v1')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  /**
   * Storefront: Validate discount code in cart/checkout
   */
  @Post('storefront/discounts/validate')
  @RateLimit(20, 60) // stops coupon-code guessing
  @HttpCode(HttpStatus.OK)
  @UseGuards(StorefrontStoreGuard)
  async validateDiscount(
    @StorefrontStore() storeId: string,
    @Body() body: { code: string; subtotalMinor: number }
  ) {
    const result = await this.discountsService.validateDiscount(body?.code, Number(body?.subtotalMinor) || 0, storeId);
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Merchant: List all store discounts
   */
  @Get('merchant/discounts')
  @UseGuards(MerchantGuard)
  async getDiscounts(@CurrentMerchant() merchant: MerchantContext) {
    const list = await this.discountsService.getStoreDiscounts(merchant.storeId);
    return {
      success: true,
      data: list,
    };
  }

  /**
   * Merchant: Create new discount rule
   */
  @Post('merchant/discounts')
  @UseGuards(MerchantGuard)
  async createDiscount(@CurrentMerchant() merchant: MerchantContext, @Body() body: CreateDiscountDto) {
    const created = await this.discountsService.createDiscount(body, merchant.storeId);
    return {
      success: true,
      data: created,
    };
  }

  /**
   * Merchant: Turn a discount on or off
   */
  @Patch('merchant/discounts/:id')
  @UseGuards(MerchantGuard)
  async setActive(
    @CurrentMerchant() merchant: MerchantContext,
    @Param('id') id: string,
    @Body() body: { isActive: boolean }
  ) {
    const updated = await this.discountsService.setActive(merchant.storeId, id, body?.isActive);
    return { success: true, data: updated };
  }
}
