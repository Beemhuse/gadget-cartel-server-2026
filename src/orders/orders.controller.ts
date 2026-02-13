import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Get user orders' })
  findAll(@Req() req) {
    return this.ordersService.findAll(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details' })
  findOne(@Param('id') id: string, @Req() req) {
    return this.ordersService.findOneForUser(id, req.user.sub);
  }

  // Checkout endpoint usually creates the order
  @Post('checkout')
  @ApiOperation({ summary: 'Checkout / Create Order' })
  create(@Req() req, @Body() body: CreateOrderDto) {
    return this.ordersService.create(req.user.sub, body);
  }
}
