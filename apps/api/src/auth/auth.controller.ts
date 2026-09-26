import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService, type SessionUser } from './auth.service';
import { CurrentMerchant, CurrentPlatformUser, MerchantGuard, PlatformGuard, type MerchantContext } from './guards';
import { clearSessionCookie, readSessionToken, setSessionCookie, setImpersonationCookies } from './session-token';
import { RateLimit } from '../common/rate-limit';

interface LoginBody {
  email: string;
  password: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('merchant/login')
  @RateLimit(10, 60)
  @HttpCode(HttpStatus.OK)
  async merchantLogin(@Body() body: LoginBody, @Res({ passthrough: true }) reply: FastifyReply) {
    const { token, user } = await this.auth.login(body?.email, body?.password, 'merchant');
    setSessionCookie(reply, 'merchant', token);
    return { success: true, data: user };
  }

  @Post('exchange-impersonation')
  @RateLimit(20, 60)
  @HttpCode(HttpStatus.OK)
  async exchangeImpersonation(
    @Body() body: { token: string },
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    if (!body?.token || typeof body.token !== 'string') {
      throw new BadRequestException('Impersonation token is required');
    }
    const { sessionToken, user, adminEmail } = await this.auth.exchangeImpersonationToken(body.token);
    setImpersonationCookies(reply, sessionToken, adminEmail);
    return { success: true, data: { user, impersonatedBy: adminEmail } };
  }

  @Post('merchant/logout')
  @HttpCode(HttpStatus.OK)
  async merchantLogout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(readSessionToken(req, 'merchant'));
    clearSessionCookie(reply, 'merchant');
    return { success: true };
  }

  @Get('merchant/me')
  @UseGuards(MerchantGuard)
  async merchantMe(@CurrentMerchant() merchant: MerchantContext) {
    const stores = await this.auth.getTenantStores(merchant.tenantId);
    return {
      success: true,
      data: {
        ...merchant.user,
        storeId: merchant.storeId,
        storeName: merchant.storeName,
        stores,
      },
    };
  }

  @Post('merchant/password')
  @RateLimit(5, 60)
  @HttpCode(HttpStatus.OK)
  @UseGuards(MerchantGuard)
  async merchantChangePassword(
    @CurrentMerchant() merchant: MerchantContext,
    @Req() req: FastifyRequest,
    @Body() body: ChangePasswordBody
  ) {
    await this.auth.changePassword(merchant.user.id, readSessionToken(req, 'merchant')!, body?.currentPassword, body?.newPassword);
    return { success: true };
  }

  @Post('platform/login')
  @RateLimit(10, 60)
  @HttpCode(HttpStatus.OK)
  async platformLogin(@Body() body: LoginBody, @Res({ passthrough: true }) reply: FastifyReply) {
    const { token, user } = await this.auth.login(body?.email, body?.password, 'platform_admin');
    setSessionCookie(reply, 'platform_admin', token);
    return { success: true, data: user };
  }

  @Post('platform/logout')
  @HttpCode(HttpStatus.OK)
  async platformLogout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(readSessionToken(req, 'platform_admin'));
    clearSessionCookie(reply, 'platform_admin');
    return { success: true };
  }

  @Get('platform/me')
  @UseGuards(PlatformGuard)
  platformMe(@CurrentPlatformUser() user: SessionUser) {
    return { success: true, data: user };
  }

  @Post('platform/password')
  @RateLimit(5, 60)
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformGuard)
  async platformChangePassword(
    @CurrentPlatformUser() user: SessionUser,
    @Req() req: FastifyRequest,
    @Body() body: ChangePasswordBody
  ) {
    await this.auth.changePassword(user.id, readSessionToken(req, 'platform_admin')!, body?.currentPassword, body?.newPassword);
    return { success: true };
  }
}
