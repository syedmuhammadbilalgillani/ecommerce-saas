import { Controller, Get, Param, NotFoundException, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { StorefrontStore, StorefrontStoreGuard } from '../auth/guards';

@Controller('v1/storefront/products')
@UseGuards(StorefrontStoreGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list(@StorefrontStore() storeId: string) {
    return {
      success: true,
      storeId,
      data: await this.productsService.listStorefrontProducts(storeId),
    };
  }

  @Get(':slug')
  async getBySlug(@StorefrontStore() storeId: string, @Param('slug') slug: string) {
    const product = await this.productsService.getProductBySlug(storeId, slug);
    if (!product) {
      throw new NotFoundException(`Product with slug '${slug}' not found`);
    }
    return {
      success: true,
      data: product,
    };
  }
}
