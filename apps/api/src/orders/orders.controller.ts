import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { OrdersService, type CheckoutDto } from './orders.service';
import { StorefrontStore, StorefrontStoreGuard } from '../auth/guards';

@Controller('v1/storefront/orders')
@UseGuards(StorefrontStoreGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  async checkout(
    @StorefrontStore() storeId: string,
    @Body() body: CheckoutDto,
    @Headers('x-cart-id') headerCartId?: string
  ) {
    if (!body) {
      throw new BadRequestException('Checkout request body is missing');
    }

    // accessToken is returned exactly once, here; only its hash is stored.
    const { order, accessToken } = await this.ordersService.checkout(body, headerCartId, storeId);
    return {
      success: true,
      data: { ...order, accessToken },
    };
  }

  @Get(':id')
  async getOrder(
    @StorefrontStore() storeId: string,
    @Param('id') id: string,
    @Headers('x-order-token') headerToken?: string,
    @Query('token') queryToken?: string
  ) {
    const order = await this.ordersService.getStorefrontOrder(storeId, id, headerToken || queryToken);
    return {
      success: true,
      data: order,
    };
  }

  @Post(':id/verify-whatsapp')
  async verifyWhatsApp(
    @StorefrontStore() storeId: string,
    @Param('id') id: string,
    @Headers('x-order-token') headerToken?: string,
    @Query('token') queryToken?: string
  ) {
    await this.ordersService.getStorefrontOrder(storeId, id, headerToken || queryToken);
    const order = await this.ordersService.verifyWhatsApp(storeId, id, 'customer');
    return {
      success: true,
      data: order,
    };
  }
}
