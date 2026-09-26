import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { MerchantProductsController } from './merchant-products.controller';
import { MerchantTaxonomyController } from './merchant-taxonomy.controller';
import { StorefrontCollectionsController } from './storefront-collections.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [
    ProductsController,
    MerchantProductsController,
    MerchantTaxonomyController,
    StorefrontCollectionsController,
  ],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
