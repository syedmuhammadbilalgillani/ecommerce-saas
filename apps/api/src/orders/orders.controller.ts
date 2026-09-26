import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { OrdersService, type CheckoutDto } from './orders.service';

@Controller('v1/storefront/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  async checkout(
    @Body() body: CheckoutDto,
    @Headers('x-cart-id') headerCartId?: string,
    @Headers('x-store-id') storeId?: string,
  ) {
    if (!body) {
      throw new BadRequestException('Checkout request body is missing');
    }

    const order = await this.ordersService.checkout(body, headerCartId, storeId);
    return {
      success: true,
      data: order,
    };
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    const order = await this.ordersService.getOrderById(id);
    return {
      success: true,
      data: order,
    };
  }

  @Post(':id/verify-whatsapp')
  async verifyWhatsApp(@Param('id') id: string) {
    const order = await this.ordersService.verifyWhatsApp(id, 'customer');
    return {
      success: true,
      data: order,
    };
  }
}
