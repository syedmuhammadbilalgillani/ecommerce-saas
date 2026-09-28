import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { MerchantUploadsController } from './merchant-uploads.controller';

@Module({
  controllers: [MerchantUploadsController],
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class UploadsModule {}
