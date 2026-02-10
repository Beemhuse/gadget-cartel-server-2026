import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Delete,
  Patch,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { OrdersService } from '../orders/orders.service';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('addresses')
  @ApiOperation({ summary: 'Get user addresses' })
  async getAddresses(@Req() req) {
    const results = await this.prisma.address.findMany({
      where: { userId: req.user.sub },
    });
    return { results };
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Create user address' })
  async createAddress(
    @Req() req: { user: { email: string } },
    @Body()
    body: {
      address?: string;
      line1?: string;
      street_address?: string;
      line2?: string;
      city: string;
      state?: string;
      region_or_state?: string;
      zip?: string;
      zip_code?: string;
      country: string;
      billing_type?: string;
    },
  ) {
    const email = req.user.email;

    // Find the real DB user using email
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      throw new Error('User not found for this token');
    }

    return this.prisma.address.create({
      data: {
        userId: user.id,
        line1: body.line1 || '',
        line2: body.line2 || null,
        city: body.city,
        state: body.state || '',
        zip: body.zip_code || body.zip || '',
        country: body.country,
        type: body.billing_type || 'billing',
      },
    });
  }

  @Get('store-locations')
  @ApiOperation({ summary: 'Get store locations' })
  async getStoreLocations() {
    return this.prisma.storeLocation.findMany({
      where: { isActive: true },
    });
  }

  @Get('delivery-methods')
  @ApiOperation({ summary: 'Get delivery methods' })
  async getDeliveryMethods() {
    return this.prisma.deliveryMethod.findMany({
      where: { isActive: true },
    });
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get user orders' })
  async getUserOrders(@Req() req, @Query() query: any) {
    return this.ordersService.findAllForUser(req.user.sub, query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get user order details' })
  async getUserOrder(@Req() req, @Param('id') id: string) {
    const order = await this.ordersService.findOneForUser(id, req.user.sub);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  // --- Admin Store Management ---

  @Post('admin/store-locations/create')
  @ApiOperation({ summary: 'Create store location (Admin)' })
  @UseGuards(AdminGuard)
  async createStore(
    @Body()
    body: {
      name: string;
      address: string;
      phone: string;
      email: string;
      isActive?: boolean;
    },
  ) {
    return this.prisma.storeLocation.create({
      data: {
        name: body.name,
        address: body.address,
        phone: body.phone,
        email: body.email,
        isActive: body.isActive ?? true,
      },
    });
  }

  @Patch('admin/store-locations/:id/update')
  @ApiOperation({ summary: 'Update store location (Admin)' })
  @UseGuards(AdminGuard)
  async updateStore(@Param('id') id: string, @Body() body: any) {
    return this.prisma.storeLocation.update({
      where: { id },
      data: body,
    });
  }

  @Delete('admin/store-locations/:id/delete')
  @ApiOperation({ summary: 'Delete store location (Admin)' })
  @UseGuards(AdminGuard)
  async deleteStore(@Param('id') id: string) {
    return this.prisma.storeLocation.delete({
      where: { id },
    });
  }

  // --- Admin Customers & Orders ---

  @Get('admin/customers')
  @ApiOperation({ summary: 'Get all customers (Admin)' })
  @UseGuards(AdminGuard)
  async getCustomers(@Query() query: any) {
    return this.usersService.findAllAdmin(query);
  }

  @Get('admin/customers/:id')
  @ApiOperation({ summary: 'Get customer details (Admin)' })
  @UseGuards(AdminGuard)
  async getCustomerDetail(@Param('id') id: string) {
    const data = await this.usersService.findAdminDetail(id);
    if (!data) {
      throw new NotFoundException('Customer not found');
    }
    return data;
  }

  @Get('admin/customers/:id/orders')
  @ApiOperation({ summary: 'Get customer orders (Admin)' })
  @UseGuards(AdminGuard)
  async getCustomerOrders(@Param('id') id: string, @Query() query: any) {
    const customer = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return this.ordersService.findAllForCustomerAdmin(id, query);
  }

  @Get('admin/customers/:id/delivery-history')
  @ApiOperation({ summary: 'Get customer delivery history (Admin)' })
  @UseGuards(AdminGuard)
  async getCustomerDeliveryHistory(
    @Param('id') id: string,
    @Query() query: any,
  ) {
    const customer = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return this.ordersService.findAllForCustomerAdmin(id, query);
  }

  @Get('admin/orders')
  @ApiOperation({ summary: 'Get all orders (Admin)' })
  @UseGuards(AdminGuard)
  async getOrders(@Query() query: any) {
    return this.ordersService.findAllAdmin(query);
  }

  @Get('admin/orders/:id')
  @ApiOperation({ summary: 'Get order details (Admin)' })
  @UseGuards(AdminGuard)
  async getOrderDetail(@Param('id') id: string) {
    return this.ordersService.findOneAdmin(id);
  }

  @Patch('admin/orders/:id')
  @ApiOperation({ summary: 'Update order (Admin)' })
  @UseGuards(AdminGuard)
  async updateOrder(@Param('id') id: string, @Body() body: any) {
    return this.ordersService.update(id, body);
  }
}
