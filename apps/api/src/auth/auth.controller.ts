import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService, type SessionUser } from './auth.service';
import { CurrentMerchant, CurrentPlatformUser, MerchantGuard, PlatformGuard, type MerchantContext } from './guards';
import { clearSessionCookie, readSessionToken, setSessionCookie } from './session-token';

interface LoginBody {
  email: string;
  password: string;
}

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('merchant/login')
  @HttpCode(HttpStatus.OK)
  async merchantLogin(@Body() body: LoginBody, @Res({ passthrough: true }) reply: FastifyReply) {
    const { token, user } = await this.auth.login(body?.email, body?.password, 'merchant');
    setSessionCookie(reply, 'merchant', token);
    return { success: true, data: user };
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
  merchantMe(@CurrentMerchant() merchant: MerchantContext) {
    return { success: true, data: { ...merchant.user, storeId: merchant.storeId, storeName: merchant.storeName } };
  }

  @Post('platform/login')
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
}
