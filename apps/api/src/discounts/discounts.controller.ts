import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { DiscountsService, CreateDiscountDto } from './discounts.service';
import {
  CurrentMerchant,
  MerchantGuard,
  StorefrontStore,
  StorefrontStoreGuard,
  type MerchantContext,
} from '../auth/guards';

@Controller('v1')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  /**
   * Storefront: Validate discount code in cart/checkout
   */
  @Post('storefront/discounts/validate')
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
}
