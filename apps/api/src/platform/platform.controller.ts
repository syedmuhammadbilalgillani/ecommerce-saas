import { Controller, Get, Post, Patch, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CurrentPlatformUser, PlatformGuard, PlatformRoleGuard, PlatformRoles } from '../auth/guards';
import type { SessionUser } from '../auth/auth.service';
import { RateLimit } from '../common/rate-limit';
import { PlatformService } from './platform.service';

@Controller('v1/platform')
@UseGuards(PlatformGuard, PlatformRoleGuard)
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
  @PlatformRoles('super_admin')
  async createTenant(
    @Body() body: { name: string; slug: string; ownerEmail: string; ownerPassword: string; plan?: string },
    @CurrentPlatformUser() admin: SessionUser
  ) {
    const data = await this.platformService.createTenant(body, admin);
    return {
      success: true,
      data,
    };
  }

  @Get('tenants/:id')
  async getTenant(@Param('id') id: string) {
    return { success: true, data: await this.platformService.getTenant(id) };
  }

  @Patch('tenants/:id')
  @PlatformRoles('super_admin', 'support')
  async updateTenant(
    @Param('id') id: string,
    @Body() body: { name?: string; storeName?: string; slug?: string; plan?: string; planPriceMinor?: number; planInterval?: string },
    @CurrentPlatformUser() admin: SessionUser
  ) {
    return { success: true, data: await this.platformService.updateTenant(id, body, admin) };
  }

  @Patch('tenants/:id/status')
  @PlatformRoles('super_admin')
  async setTenantStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentPlatformUser() admin: SessionUser
  ) {
    const data = await this.platformService.setTenantStatus(id, body?.status, admin);
    return {
      success: true,
      data,
    };
  }

  @Get('tenants/:id/cloudinary')
  async getTenantCloudinary(@Param('id') id: string) {
    return { success: true, data: await this.platformService.getTenantCloudinary(id) };
  }

  @Put('tenants/:id/cloudinary')
  @PlatformRoles('super_admin')
  @RateLimit(10, 60)
  async setTenantCloudinary(
    @Param('id') id: string,
    @Body() body: { cloudName?: string; apiKey?: string; apiSecret?: string },
    @CurrentPlatformUser() admin: SessionUser
  ) {
    return { success: true, data: await this.platformService.setTenantCloudinary(id, body, admin) };
  }

  @Delete('tenants/:id/cloudinary')
  @PlatformRoles('super_admin')
  @HttpCode(HttpStatus.OK)
  async removeTenantCloudinary(@Param('id') id: string, @CurrentPlatformUser() admin: SessionUser) {
    await this.platformService.removeTenantCloudinary(id, admin);
    return { success: true };
  }

  @Post('tenants/:id/stores')
  @PlatformRoles('super_admin', 'support')
  async addTenantStore(
    @Param('id') id: string,
    @Body() body: { name: string; slug: string; whatsappPhone?: string },
    @CurrentPlatformUser() admin: SessionUser
  ) {
    const data = await this.platformService.addTenantStore(id, body, admin);
    return { success: true, data };
  }

  @Get('tenants/:id/users')
  async listTenantUsers(@Param('id') id: string) {
    return { success: true, data: await this.platformService.listTenantUsers(id) };
  }

  @Post('tenants/:id/users')
  @PlatformRoles('super_admin', 'support')
  async createTenantUser(
    @Param('id') id: string,
    @Body() body: { email: string; password: string; name?: string },
    @CurrentPlatformUser() admin: SessionUser
  ) {
    return { success: true, data: await this.platformService.createTenantUser(id, body, admin) };
  }

  @Patch('tenants/:id/users/:userId/status')
  @PlatformRoles('super_admin', 'support')
  async setTenantUserStatus(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { status: string },
    @CurrentPlatformUser() admin: SessionUser
  ) {
    return { success: true, data: await this.platformService.setTenantUserStatus(id, userId, body?.status, admin) };
  }

  @Post('users/:id/password')
  @PlatformRoles('super_admin', 'support')
  @RateLimit(10, 60)
  @HttpCode(HttpStatus.OK)
  async resetMerchantPassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
    @CurrentPlatformUser() admin: SessionUser
  ) {
    await this.platformService.resetMerchantPassword(id, body?.newPassword, admin);
    return { success: true };
  }

  @Post('tenants/:id/impersonate')
  @PlatformRoles('super_admin', 'support')
  async impersonateTenant(
    @Param('id') id: string,
    @CurrentPlatformUser() admin: SessionUser,
    @Body() body?: { userId?: string }
  ) {
    const data = await this.platformService.impersonateTenant(id, admin, body?.userId);
    return { success: true, data };
  }

  @Get('admins')
  async listAdmins() {
    return { success: true, data: await this.platformService.listAdmins() };
  }

  @Post('admins')
  @PlatformRoles('super_admin')
  async createAdmin(
    @Body() body: { email: string; password: string; name?: string; platformRole?: string },
    @CurrentPlatformUser() admin: SessionUser
  ) {
    return { success: true, data: await this.platformService.createAdmin(body, admin) };
  }

  @Patch('admins/:id/status')
  @PlatformRoles('super_admin')
  async setAdminStatus(
    @Param('id') id: string,
    @CurrentPlatformUser() admin: SessionUser,
    @Body() body: { status: string }
  ) {
    return { success: true, data: await this.platformService.setAdminStatus(id, admin.id, body?.status, admin) };
  }

  @Post('admins/:id/password')
  @PlatformRoles('super_admin')
  @RateLimit(10, 60)
  @HttpCode(HttpStatus.OK)
  async resetAdminPassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
    @CurrentPlatformUser() admin: SessionUser
  ) {
    await this.platformService.resetAdminPassword(id, body?.newPassword, admin);
    return { success: true };
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const data = await this.platformService.getAuditLogs({
      limit: isNaN(parsedLimit) ? 50 : parsedLimit,
      action: action || undefined,
      targetType: targetType || undefined,
    });
    return { success: true, data };
  }
}
