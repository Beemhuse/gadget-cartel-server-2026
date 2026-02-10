import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [UsersModule, OrdersModule],
  controllers: [CustomersController],
})
export class CustomersModule {}
