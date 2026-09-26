import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CurrentMerchant, MerchantGuard, type MerchantContext } from '../auth/guards';

@Controller('v1/merchant/products')
@UseGuards(MerchantGuard)
export class MerchantProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list(@CurrentMerchant() merchant: MerchantContext) {
    const products = await this.productsService.listMerchantProducts(merchant.storeId);
    return {
      success: true,
      data: products,
    };
  }

  @Post()
  async create(@CurrentMerchant() merchant: MerchantContext, @Body() body: any) {
    const created = await this.productsService.createMerchantProduct(merchant.storeId, body);
    return {
      success: true,
      data: created,
    };
  }
}
