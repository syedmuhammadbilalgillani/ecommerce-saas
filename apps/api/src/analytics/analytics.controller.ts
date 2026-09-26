import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CurrentMerchant, MerchantGuard, type MerchantContext } from '../auth/guards';

@Controller('v1/merchant/analytics')
@UseGuards(MerchantGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getAnalytics(@CurrentMerchant() merchant: MerchantContext) {
    const data = await this.analyticsService.getStoreAnalytics(merchant.storeId);
    return {
      success: true,
      data,
    };
  }
}
