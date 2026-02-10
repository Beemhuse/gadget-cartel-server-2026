import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersPublicController } from './customers.public.controller';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [UsersModule, OrdersModule],
  controllers: [CustomersController, CustomersPublicController],
})
export class CustomersModule {}
