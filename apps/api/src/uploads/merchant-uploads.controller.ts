import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentMerchant, MerchantGuard, type MerchantContext } from '../auth/guards';
import { RateLimit } from '../common/rate-limit';
import { CloudinaryService } from './cloudinary.service';

@Controller('v1/merchant/uploads')
@UseGuards(MerchantGuard)
export class MerchantUploadsController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Get('config')
  async config(@CurrentMerchant() merchant: MerchantContext) {
    const cfg = await this.cloudinary.getPublicConfig(merchant.tenantId);
    return { success: true, data: { enabled: cfg.configured } };
  }

  @Post('sign')
  @RateLimit(60, 60)
  async sign(@CurrentMerchant() merchant: MerchantContext) {
    return { success: true, data: await this.cloudinary.signUpload(merchant.tenantId) };
  }
}
