import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { OrdersSummaryService } from './orders.summary.service';
import { OrdersReviewService } from './orders.review.service';
import { OrdersEmailService } from './orders.email.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersSummaryService,
    OrdersReviewService,
    OrdersEmailService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
