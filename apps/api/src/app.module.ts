import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { DiscountsModule } from './discounts/discounts.module';
import { CustomersModule } from './customers/customers.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PlatformModule } from './platform/platform.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    DbModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    DiscountsModule,
    CustomersModule,
    AnalyticsModule,
    PlatformModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
