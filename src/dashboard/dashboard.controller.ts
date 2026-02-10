import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get user dashboard summary' })
  getUserSummary(@Req() req) {
    return this.dashboardService.getUserSummary(req.user.id);
  }

  @Get('my-orders')
  @ApiOperation({ summary: 'Get user order history with pagination' })
  getMyOrders(@Req() req, @Query() query: any) {
    return this.dashboardService.getMyOrders(req.user.id, query);
  }

  @Get('product-warranty-summary')
  @ApiOperation({ summary: 'Get product warranty summary' })
  getProductWarrantySummary(@Req() req) {
    return this.dashboardService.getProductWarrantySummary(req.user.id);
  }

  // Admin route (needs admin guard in real app)
  @Get('admin/overview')
  @ApiOperation({ summary: 'Get admin dashboard overview' })
  getAdminOverview() {
    return this.dashboardService.getAdminOverview();
  }

  @Get('admin/orders-customers-overview')
  @ApiOperation({ summary: 'Get admin orders/customers overview' })
  getOrdersCustomersOverview() {
    return this.dashboardService.getOrdersCustomersOverview();
  }

  @Get('admin/low-stock')
  @ApiOperation({ summary: 'Get low stock products' })
  getLowStockProducts() {
    return this.dashboardService.getLowStockProducts();
  }

  @Get('admin/customer-growth-chart')
  @ApiOperation({ summary: 'Get customer growth chart' })
  getCustomerGrowthChart() {
    return this.dashboardService.getCustomerGrowthChart();
  }
}
