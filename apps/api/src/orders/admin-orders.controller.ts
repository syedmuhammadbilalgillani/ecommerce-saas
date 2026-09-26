import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Headers,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller(['v1/merchant', 'v1/admin'])
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('orders')
  async listOrders(@Headers('x-store-id') headerStoreId?: string, @Query('storeId') queryStoreId?: string) {
    const storeId = headerStoreId || queryStoreId || 'store_default';
    const orders = await this.ordersService.listAdminOrders(storeId);
    return {
      success: true,
      count: orders.length,
      data: orders,
    };
  }

  @Get('analytics')
  async getAnalytics(@Headers('x-store-id') headerStoreId?: string, @Query('storeId') queryStoreId?: string) {
    const storeId = headerStoreId || queryStoreId || 'store_default';
    const analytics = await this.ordersService.getAnalytics(storeId);
    return {
      success: true,
      data: analytics,
    };
  }

  @Patch('orders/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { financialStatus?: string; fulfillmentStatus?: string; orderStatus?: string }
  ) {
    const updated = await this.ordersService.updateOrderStatus(id, body);
    return {
      success: true,
      data: updated,
    };
  }

  @Post('orders/:id/book-courier')
  async bookCourier(
    @Param('id') id: string,
    @Body() body?: { courierName?: string }
  ) {
    const courier = body?.courierName || 'Trax';
    const result = await this.ordersService.bookCourier(id, courier);
    return {
      success: true,
      data: result,
    };
  }

  @Get('orders/:id')
  async getOrder(@Param('id') id: string) {
    const order = await this.ordersService.getOrderById(id);
    return {
      success: true,
      data: order,
    };
  }

  @Patch('orders/:id/notes')
  async updateNotes(
    @Param('id') id: string,
    @Body() body: { notes: string }
  ) {
    const updated = await this.ordersService.updateOrderNotes(id, body?.notes || '');
    return {
      success: true,
      data: updated,
    };
  }

  @Post('orders/:id/verify-whatsapp')
  async verifyWhatsApp(
    @Param('id') id: string,
    @Body() body?: { verifiedBy?: 'customer' | 'merchant' }
  ) {
    const verified = await this.ordersService.verifyWhatsApp(id, body?.verifiedBy || 'merchant');
    return {
      success: true,
      data: verified,
    };
  }
}
