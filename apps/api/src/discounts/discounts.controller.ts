import { Controller, Post, Get, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { DiscountsService, CreateDiscountDto } from './discounts.service';

@Controller('v1')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  /**
   * Storefront: Validate discount code in cart/checkout
   */
  @Post('storefront/discounts/validate')
  @HttpCode(HttpStatus.OK)
  async validateDiscount(
    @Body() body: { code: string; subtotalMinor: number },
    @Headers('x-store-id') storeId?: string,
    @Headers('x-tenant-id') tenantId?: string
  ) {
    const result = await this.discountsService.validateDiscount(
      body.code,
      body.subtotalMinor,
      storeId,
      tenantId
    );
    return {
      success: true,
      data: result,
    };
  }

  /**
   * Merchant: List all store discounts
   */
  @Get('merchant/discounts')
  async getDiscounts(@Headers('x-store-id') storeId?: string) {
    const list = await this.discountsService.getStoreDiscounts(storeId);
    return {
      success: true,
      data: list,
    };
  }

  /**
   * Merchant: Create new discount rule
   */
  @Post('merchant/discounts')
  async createDiscount(
    @Body() body: CreateDiscountDto,
    @Headers('x-store-id') storeId?: string,
    @Headers('x-tenant-id') tenantId?: string
  ) {
    const created = await this.discountsService.createDiscount(body, storeId, tenantId);
    return {
      success: true,
      data: created,
    };
  }
}
