import { Controller, Get, Post, Patch, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { PlatformGuard } from '../auth/guards';
import { RateLimit } from '../common/rate-limit';
import { PlatformService } from './platform.service';

@Controller('v1/platform')
@UseGuards(PlatformGuard)
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
  async createTenant(@Body() body: { name: string; slug: string; ownerEmail: string; ownerPassword: string }) {
    const data = await this.platformService.createTenant(body);
    return {
      success: true,
      data,
    };
  }

  @Patch('tenants/:id/status')
  async setTenantStatus(@Param('id') id: string, @Body() body: { status: string }) {
    const data = await this.platformService.setTenantStatus(id, body?.status);
    return {
      success: true,
      data,
    };
  }

  @Get('tenants/:id/users')
  async listTenantUsers(@Param('id') id: string) {
    return { success: true, data: await this.platformService.listTenantUsers(id) };
  }

  @Post('users/:id/password')
  @RateLimit(10, 60)
  @HttpCode(HttpStatus.OK)
  async resetMerchantPassword(@Param('id') id: string, @Body() body: { newPassword: string }) {
    await this.platformService.resetMerchantPassword(id, body?.newPassword);
    return { success: true };
  }
}
