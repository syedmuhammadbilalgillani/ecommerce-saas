import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
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

  @Patch(':productId')
  async update(@CurrentMerchant() merchant: MerchantContext, @Param('productId') productId: string, @Body() body: any) {
    const updated = await this.productsService.updateMerchantProduct(merchant.storeId, productId, body);
    return { success: true, data: updated };
  }

  @Patch(':productId/variants/:variantId')
  async updateVariant(
    @CurrentMerchant() merchant: MerchantContext,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() body: any
  ) {
    const updated = await this.productsService.updateMerchantVariant(merchant.storeId, productId, variantId, body);
    return { success: true, data: updated };
  }

  @Post(':productId/variants/:variantId/stock-adjustments')
  async adjustStock(
    @CurrentMerchant() merchant: MerchantContext,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() body: { delta: number }
  ) {
    const updated = await this.productsService.adjustVariantStock(merchant.storeId, productId, variantId, body?.delta);
    return { success: true, data: updated };
  }
}
