import { Controller, Get, Param, NotFoundException, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { StorefrontStore, StorefrontStoreGuard } from '../auth/guards';

@Controller('v1/storefront/collections')
@UseGuards(StorefrontStoreGuard)
export class StorefrontCollectionsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list(@StorefrontStore() storeId: string) {
    const data = await this.productsService.listCollections(storeId);
    return {
      success: true,
      data,
    };
  }

  @Get(':slug')
  async getBySlug(@StorefrontStore() storeId: string, @Param('slug') slug: string) {
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
