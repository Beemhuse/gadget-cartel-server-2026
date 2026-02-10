import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getUserSummary(userId: string) {
    const orders = await this.prisma.order.count({ where: { userId } });
    const pendingOrders = await this.prisma.order.count({
      where: { userId, status: 'PENDING' },
    });
    return {
      totalOrders: orders,
      pendingOrders,
    };
  }

  async getMyOrders(userId: string, query: any) {
    const { page = 1, page_size = 10 } = query;
    const skip = (Number(page) - 1) * Number(page_size);
    const take = Number(page_size);

    const [results, totalCount] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          address: true,
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    // Enhance orders with dummy order_number if missing
    const enhancedResults = results.map((order) => ({
      ...order,
      order_number: order.id.slice(0, 8).toUpperCase(),
    }));

    return {
      results: enhancedResults,
      totalCount,
    };
  }

  async getProductWarrantySummary(userId: string) {
    // Dummy stats for now
    return {
      data: {
        products_purchased: 0,
        active_warranties: 0,
        rejected_warranties: 0,
      },
    };
  }

  async getAdminOverview() {
    const [
      totalUsers,
      totalOrders,
      totalRevenue,
      available_products,
      lowStockCount,
      activeAdsCount,
      activeCouponsCount,
      recentOrders,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        _sum: { total: true },
      }),
      this.prisma.product.count({
        where: { isActive: true, stockQuantity: { gt: 0 } },
      }),
      this.prisma.product.count({
        where: {
          OR: [
            { stockQuantity: { lte: 0 } },
            // Add custom logic for low stock threshold if needed
          ],
        },
      }),
      this.prisma.ad.count({ where: { isPublished: true } }),
      this.prisma.coupon.count({ where: { isActive: true } }),
      this.prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      }),
    ]);

    return {
      totalUsers,
      totalOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      available_products,
      lowStockCount,
      activeAdsCount,
      activeCouponsCount,
      recentOrders,
    };
  }

  async getOrdersCustomersOverview() {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const [allOrders, completedOrders, totalEarnings, newCustomers] =
      await Promise.all([
        this.prisma.order.count(),
        this.prisma.order.count({
          where: {
            status: { in: ['DELIVERED', 'COMPLETED'] },
          },
        }),
        this.prisma.order.aggregate({
          _sum: { total: true },
        }),
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: sevenDaysAgo,
            },
          },
        }),
      ]);

    return {
      all_orders: allOrders,
      completed_orders: completedOrders,
      total_earnings: Number(totalEarnings._sum.total || 0),
      new_customers_last_7_days: newCustomers,
    };
  }

  async getLowStockProducts() {
    const defaultThreshold = 10;
    const products = await this.prisma.product.findMany({
      where: {
        OR: [
          { stockQuantity: { lte: defaultThreshold } },
          { lowStockThreshold: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        stockQuantity: true,
        lowStockThreshold: true,
      },
    });

    const lowStock = products.filter((item) => {
      const threshold =
        Number(item.lowStockThreshold || 0) > 0
          ? Number(item.lowStockThreshold)
          : defaultThreshold;
      return Number(item.stockQuantity || 0) <= threshold;
    });

    lowStock.sort(
      (a, b) => Number(a.stockQuantity || 0) - Number(b.stockQuantity || 0),
    );

    return {
      count: lowStock.length,
      results: lowStock.slice(0, 5).map((item) => ({
        ...item,
        stock_quantity: item.stockQuantity,
        product_slug: item.slug,
      })),
    };
  }

  async getCustomerGrowthChart() {
    const monthsToShow = 12;
    const now = new Date();

    const monthBuckets = Array.from({ length: monthsToShow }).map((_, idx) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (monthsToShow - 1 - idx), 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      return {
        start,
        end,
        monthName: start.toLocaleString('en-US', { month: 'long' }),
      };
    });

    const results = await Promise.all(
      monthBuckets.map(async (bucket) => {
        const total = await this.prisma.user.count({
          where: {
            createdAt: {
              gte: bucket.start,
              lt: bucket.end,
            },
          },
        });

        return {
          month_name: bucket.monthName,
          online_customers: total,
          offline_customers: 0,
          total_customers: total,
        };
      }),
    );

    return results;
  }
}
