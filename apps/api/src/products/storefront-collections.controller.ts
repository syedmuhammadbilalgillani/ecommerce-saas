import { Controller, Get, Param, Headers, Query, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('v1/storefront/collections')
export class StorefrontCollectionsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list(
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

  @Get(':slug')
  async getBySlug(
    @Param('slug') slug: string,
    @Headers('x-store-id') headerStoreId?: string,
    @Query('storeId') queryStoreId?: string
  ) {
    const storeId = headerStoreId || queryStoreId || 'store_default';
    const collection = await this.productsService.getCollectionBySlug(storeId, slug);
    if (!collection) {
      throw new NotFoundException(`Collection with slug '${slug}' not found`);
    }
    return {
      success: true,
      data: collection,
    };
  }
}
