import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';
import { CartModule } from '../cart/cart.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [CartModule, DiscountsModule, CustomersModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
