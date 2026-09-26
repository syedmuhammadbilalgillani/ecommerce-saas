import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CurrentMerchant, MerchantGuard, type MerchantContext } from '../auth/guards';

@Controller('v1/merchant')
@UseGuards(MerchantGuard)
export class MerchantTaxonomyController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('categories')
  async listCategories() {
    const data = await this.productsService.listCategories();
    return {
      success: true,
      data,
    };
  }

  @Get('collections')
  async listCollections(@CurrentMerchant() merchant: MerchantContext) {
    const data = await this.productsService.listCollections(merchant.storeId);
    return {
      success: true,
      data,
    };
  }

  @Post('collections')
  async createCollection(@CurrentMerchant() merchant: MerchantContext, @Body() body: any) {
    const data = await this.productsService.createCollection(merchant.storeId, body);
    return {
      success: true,
      data,
    };
  }
}
