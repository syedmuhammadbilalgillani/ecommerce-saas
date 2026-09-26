import { Controller, Get, Param, Headers, Query, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('v1/storefront/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list(
    @Headers('x-store-id') headerStoreId?: string,
    @Query('storeId') queryStoreId?: string
  ) {
    const storeId = headerStoreId || queryStoreId || 'store_default';
    return {
      success: true,
      storeId,
      data: await this.productsService.listStorefrontProducts(storeId),
    };
  }

  @Get(':slug')
  async getBySlug(
    @Param('slug') slug: string,
    @Headers('x-store-id') headerStoreId?: string,
    @Query('storeId') queryStoreId?: string
  ) {
    const storeId = headerStoreId || queryStoreId || 'store_default';
    const product = await this.productsService.getProductBySlug(storeId, slug);
    if (!product) {
      throw new NotFoundException(`Product with slug '${slug}' not found for store '${storeId}'`);
    }
    return {
      success: true,
      data: product,
    };
  }
}
