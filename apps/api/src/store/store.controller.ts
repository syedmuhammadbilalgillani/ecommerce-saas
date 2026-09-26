import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { StoreService, type UpdateStoreSettingsDto } from './store.service';
import {
  CurrentMerchant,
  MerchantGuard,
  StorefrontStore,
  StorefrontStoreGuard,
  type MerchantContext,
} from '../auth/guards';

@Controller('v1/merchant/store')
@UseGuards(MerchantGuard)
export class MerchantStoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  async get(@CurrentMerchant() merchant: MerchantContext) {
    return { success: true, data: await this.storeService.getSettings(merchant.storeId) };
  }

  @Patch()
  async update(@CurrentMerchant() merchant: MerchantContext, @Body() body: UpdateStoreSettingsDto) {
    return { success: true, data: await this.storeService.updateSettings(merchant.storeId, body) };
  }
}

/** Public, read-only store info for the storefront (name, WhatsApp contact). */
@Controller('v1/storefront/store')
@UseGuards(StorefrontStoreGuard)
export class StorefrontStoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  async get(@StorefrontStore() storeId: string) {
    const { id, name, currency, whatsappPhone } = await this.storeService.getSettings(storeId);
    return { success: true, data: { id, name, currency, whatsappPhone } };
  }
}
