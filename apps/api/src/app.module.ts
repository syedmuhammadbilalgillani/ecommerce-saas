import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './common/rate-limit';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { DiscountsModule } from './discounts/discounts.module';
import { CustomersModule } from './customers/customers.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PlatformModule } from './platform/platform.module';
import { StoreModule } from './store/store.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    DbModule,
    AuthModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    DiscountsModule,
    CustomersModule,
    AnalyticsModule,
    PlatformModule,
    StoreModule,
  ],
  controllers: [AppController],
  // Runs before every route guard, so abusive clients are cut off before any DB work.
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }],
})
export class AppModule {}
