import { Controller, Get, Post, Body } from '@nestjs/common';
import { PlatformService } from './platform.service';

@Controller('v1/platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('analytics')
  async getAnalytics() {
    const data = await this.platformService.getPlatformAnalytics();
    return {
      success: true,
      data,
    };
  }

  @Get('tenants')
  async listTenants() {
    const data = await this.platformService.listTenants();
    return {
      success: true,
      data,
    };
  }

  @Post('tenants')
  async createTenant(@Body() body: { name: string; slug: string; plan?: string }) {
    const data = await this.platformService.createTenant(body);
    return {
      success: true,
      data,
    };
  }
}
