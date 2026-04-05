import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReferralsModule } from './referrals/referrals.module';
import { CouponsModule } from './coupons/coupons.module';
import { AdsModule } from './ads/ads.module';
import { SupportModule } from './support/support.module';
import { SettingsModule } from './settings/settings.module';
import { CustomersModule } from './customers/customers.module';
import { ReviewsModule } from './reviews/reviews.module';
import { DisputesModule } from './disputes/disputes.module';
import { BannersModule } from './banners/banners.module';
import { ThrottlerModule } from '@nestjs/throttler/dist/throttler.module';
import { ThrottlerGuard } from '@nestjs/throttler/dist/throttler.guard';
import { APP_GUARD } from '@nestjs/core/constants';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ✅ Rate limiting
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 100,
        },
      ],
    }),

    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    DashboardModule,
    NotificationsModule,
    ReferralsModule,
    CouponsModule,
    AdsModule,
    BannersModule,
    SupportModule,
    SettingsModule,
    CustomersModule,
    ReviewsModule,
    DisputesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
