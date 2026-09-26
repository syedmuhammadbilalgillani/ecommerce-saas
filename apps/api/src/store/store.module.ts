import { Module } from '@nestjs/common';
import { MerchantStoreController, StorefrontStoreController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  controllers: [MerchantStoreController, StorefrontStoreController],
  providers: [StoreService],
})
export class StoreModule {}
