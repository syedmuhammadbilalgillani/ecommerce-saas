import { Controller, Get, Post, Body, Headers, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller(['v1/merchant/products', 'v1/admin/products'])
export class MerchantProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list(
    @Headers('x-store-id') headerStoreId?: string,
    @Query('storeId') queryStoreId?: string
  ) {
    const storeId = headerStoreId || queryStoreId || 'store_default';
    const products = await this.productsService.listMerchantProducts(storeId);
    return {
      success: true,
      data: products,
    };
  }

  @Post()
  async create(
    @Body() body: any,
    @Headers('x-store-id') headerStoreId?: string,
    @Query('storeId') queryStoreId?: string
  ) {
    const storeId = headerStoreId || queryStoreId || 'store_default';
    const created = await this.productsService.createMerchantProduct(storeId, body);
    return {
      success: true,
      data: created,
    };
  }
}
