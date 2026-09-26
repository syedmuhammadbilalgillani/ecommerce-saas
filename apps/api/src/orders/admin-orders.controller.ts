import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { OrdersService, type OrderStatusUpdate } from './orders.service';
import { CurrentMerchant, MerchantGuard, type MerchantContext } from '../auth/guards';

@Controller('v1/merchant')
@UseGuards(MerchantGuard)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('orders')
  async listOrders(@CurrentMerchant() merchant: MerchantContext) {
    const orders = await this.ordersService.listAdminOrders(merchant.storeId);
    return {
      success: true,
      count: orders.length,
      data: orders,
    };
  }

  @Patch('orders/:id/status')
  async updateStatus(
    @CurrentMerchant() merchant: MerchantContext,
    @Param('id') id: string,
    @Body() body: OrderStatusUpdate
  ) {
    const updated = await this.ordersService.updateOrderStatus(merchant.storeId, id, body);
    return {
      success: true,
      data: updated,
    };
  }

  @Post('orders/:id/book-courier')
  async bookCourier(
    @CurrentMerchant() merchant: MerchantContext,
    @Param('id') id: string,
    @Body() body?: { courierName?: string }
  ) {
    const courier = body?.courierName || 'Trax';
    const result = await this.ordersService.bookCourier(merchant.storeId, id, courier);
    return {
      success: true,
      data: result,
    };
  }

  @Get('orders/:id')
  async getOrder(@CurrentMerchant() merchant: MerchantContext, @Param('id') id: string) {
    const order = await this.ordersService.getStoreOrder(merchant.storeId, id);
    return {
      success: true,
      data: order,
    };
  }

  @Patch('orders/:id/notes')
  async updateNotes(
    @CurrentMerchant() merchant: MerchantContext,
    @Param('id') id: string,
    @Body() body: { notes: string }
  ) {
    const notes = typeof body?.notes === 'string' ? body.notes : '';
    const updated = await this.ordersService.updateOrderNotes(merchant.storeId, id, notes);
    return {
      success: true,
      data: updated,
    };
  }

  @Post('orders/:id/verify-whatsapp')
  async verifyWhatsApp(@CurrentMerchant() merchant: MerchantContext, @Param('id') id: string) {
    const verified = await this.ordersService.verifyWhatsApp(merchant.storeId, id, 'merchant');
    return {
      success: true,
      data: verified,
    };
  }
}
