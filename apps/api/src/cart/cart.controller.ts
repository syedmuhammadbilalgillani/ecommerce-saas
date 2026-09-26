import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { StorefrontStore, StorefrontStoreGuard } from '../auth/guards';
import { RateLimit } from '../common/rate-limit';

const MAX_LINE_QUANTITY = 999;

function parseQuantity(raw: unknown, { allowZero }: { allowZero: boolean }): number {
  const qty = raw === undefined ? 1 : raw;
  const min = allowZero ? 0 : 1;
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < min || qty > MAX_LINE_QUANTITY) {
    throw new BadRequestException(`quantity must be a whole number between ${min} and ${MAX_LINE_QUANTITY}`);
  }
  return qty;
}

@Controller('v1/storefront/cart')
@UseGuards(StorefrontStoreGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(
    @StorefrontStore() storeId: string,
    @Headers('x-cart-id') headerCartId?: string,
    @Query('cartId') queryCartId?: string
  ) {
    const cartId = headerCartId || queryCartId;
    const cart = await this.cartService.getOrCreateCart(cartId, storeId);
    return {
      success: true,
      data: cart,
    };
  }

  @Post('items')
  @RateLimit(60, 60)
  async addItem(
    @StorefrontStore() storeId: string,
    @Body() body: { variantId: string; quantity?: number },
    @Headers('x-cart-id') headerCartId?: string
  ) {
    if (!body?.variantId) {
      throw new BadRequestException('variantId is required');
    }

    const qty = parseQuantity(body.quantity, { allowZero: false });
    const cart = await this.cartService.addItem(headerCartId, body.variantId, qty, storeId);

    return {
      success: true,
      data: cart,
    };
  }

  @Patch('items/:itemId')
  async updateQuantity(
    @StorefrontStore() storeId: string,
    @Param('itemId') itemId: string,
    @Body() body: { quantity: number },
    @Headers('x-cart-id') headerCartId?: string,
    @Query('cartId') queryCartId?: string
  ) {
    const cartId = headerCartId || queryCartId;
    if (!cartId) {
      throw new BadRequestException('x-cart-id header or cartId query parameter is required');
    }

    const qty = parseQuantity(body?.quantity, { allowZero: true });
    const cart = await this.cartService.updateItemQuantity(cartId, itemId, qty, storeId);

    return {
      success: true,
      data: cart,
    };
  }

  @Delete('items/:itemId')
  async removeItem(
    @StorefrontStore() storeId: string,
    @Param('itemId') itemId: string,
    @Headers('x-cart-id') headerCartId?: string,
    @Query('cartId') queryCartId?: string
  ) {
    const cartId = headerCartId || queryCartId;
    if (!cartId) {
      throw new BadRequestException('x-cart-id header or cartId query parameter is required');
    }

    const cart = await this.cartService.removeItem(cartId, itemId, storeId);
    return {
      success: true,
      data: cart,
    };
  }
}
