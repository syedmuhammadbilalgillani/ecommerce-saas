import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MerchantGuard, PlatformGuard, StorefrontStoreGuard } from './guards';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, MerchantGuard, PlatformGuard, StorefrontStoreGuard],
  exports: [AuthService, MerchantGuard, PlatformGuard, StorefrontStoreGuard],
})
export class AuthModule {}
