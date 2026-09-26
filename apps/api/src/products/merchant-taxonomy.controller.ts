import { Controller, Get, Post, Body, Headers, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller(['v1/merchant', 'v1/admin'])
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
  async listCollections(
    @Headers('x-store-id') headerStoreId?: string,
    @Query('storeId') queryStoreId?: string
  ) {
    const storeId = headerStoreId || queryStoreId || 'store_default';
    const data = await this.productsService.listCollections(storeId);
    return {
      success: true,
      data,
    };
  }

  @Post('collections')
  async createCollection(
    @Body() body: any,
    @Headers('x-store-id') headerStoreId?: string,
    @Query('storeId') queryStoreId?: string
  ) {
    const storeId = headerStoreId || queryStoreId || 'store_default';
    const data = await this.productsService.createCollection(storeId, body);
    return {
      success: true,
      data,
    };
  }
}
