import { Controller, Get, Headers } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('v1/merchant/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getAnalytics(@Headers('x-store-id') storeId?: string) {
    const data = await this.analyticsService.getStoreAnalytics(storeId);
    return {
      success: true,
      data,
    };
  }
}
