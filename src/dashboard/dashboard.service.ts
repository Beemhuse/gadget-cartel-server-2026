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
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - (monthsToShow - 1 - idx),
        1,
      );
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

  async getAdminAdvancedAnalytics() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [revenueAgg, totalOrders, newCustomers, orderItems] =
      await Promise.all([
        this.prisma.order.aggregate({
          _sum: { total: true },
        }),
        this.prisma.order.count(),
        this.prisma.user.count({
          where: {
            createdAt: {
              gte: thirtyDaysAgo,
            },
          },
        }),
        this.prisma.orderItem.findMany({
          select: {
            quantity: true,
            order: { select: { status: true } },
          },
        }),
      ]);

    const productsSoldCount = orderItems.reduce((sum, item) => {
      if ((item.order?.status || '').toUpperCase() === 'CANCELLED') {
        return sum;
      }
      return sum + Number(item.quantity || 0);
    }, 0);

    // Calculate Average Order Value (AOV)
    const totalRevenue = Number(revenueAgg._sum.total || 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      total_revenue: totalRevenue,
      total_orders_received: totalOrders,
      new_customers_count: newCustomers,
      products_sold_count: productsSoldCount,
      average_order_value: averageOrderValue,
    };
  }

  async getAdminRevenueChart(query: any = {}) {
    const monthsToShow = Number(query.months) > 0 ? Number(query.months) : 12;
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth() - (monthsToShow - 1),
      1,
    );
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      select: {
        total: true,
        createdAt: true,
        status: true,
      },
    });

    const buckets = Array.from({ length: monthsToShow }).map((_, idx) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - (monthsToShow - 1 - idx),
        1,
      );
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      return {
        key,
        monthName: date.toLocaleString('en-US', { month: 'long' }),
        total: 0,
      };
    });

    const bucketMap = new Map(buckets.map((b) => [b.key, b]));

    orders.forEach((order) => {
      if ((order.status || '').toUpperCase() === 'CANCELLED') return;
      const dt = order.createdAt;
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      const bucket = bucketMap.get(key);
      if (bucket) {
        bucket.total += Number(order.total || 0);
      }
    });

    return buckets.map((bucket) => ({
      month_name: bucket.monthName,
      offline_revenue: 0,
      online_revenue: bucket.total,
      total_revenue: bucket.total,
    }));
  }

  async getAdminBestSellers(query: any = {}) {
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 5;

    const items = await this.prisma.orderItem.findMany({
      select: {
        quantity: true,
        price: true,
        product: {
          select: {
            id: true,
            name: true,
            category: { select: { id: true, name: true } },
          },
        },
        order: { select: { status: true } },
      },
    });

    const productMap = new Map<
      string,
      { product_name: string; units_sold: number; total_revenue: number }
    >();
    const categoryMap = new Map<
      string,
      { category_name: string; total: number }
    >();

    items.forEach((item) => {
      if ((item.order?.status || '').toUpperCase() === 'CANCELLED') return;
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const revenue = quantity * price;
      const productId = item.product?.id || 'unknown';
      const productName = item.product?.name || 'Unknown';

      const productEntry = productMap.get(productId) || {
        product_name: productName,
        units_sold: 0,
        total_revenue: 0,
      };
      productEntry.units_sold += quantity;
      productEntry.total_revenue += revenue;
      productMap.set(productId, productEntry);

      const categoryId = item.product?.category?.id || 'uncategorized';
      const categoryName = item.product?.category?.name || 'Uncategorized';
      const categoryEntry = categoryMap.get(categoryId) || {
        category_name: categoryName,
        total: 0,
      };
      categoryEntry.total += revenue;
      categoryMap.set(categoryId, categoryEntry);
    });

    const bestSellingProducts = Array.from(productMap.values())
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, limit)
      .map((item) => ({
        product_name: item.product_name,
        units_sold: item.units_sold,
        quantity_sold: item.units_sold,
        total_revenue: item.total_revenue,
        total: item.total_revenue,
      }));

    const bestSellingCategories = Array.from(categoryMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
      .map((item) => ({
        category_name: item.category_name,
        total_revenue: item.total,
        revenue: item.total,
        total: item.total,
      }));

    return {
      best_selling_products: bestSellingProducts,
      best_selling_categories: bestSellingCategories,
    };
  }

  async SalesByCategory(query: any = {}) {
    const items = await this.prisma.orderItem.findMany({
      select: {
        quantity: true,
        price: true,
        product: {
          select: {
            category: { select: { name: true } },
          },
        },
        order: { select: { status: true } },
      },
    });

    const categoryMap = new Map<string, number>();

    items.forEach((item) => {
      if ((item.order?.status || '').toUpperCase() === 'CANCELLED') return;
      const revenue = Number(item.price || 0) * Number(item.quantity || 0);
      const categoryName = item.product?.category?.name || 'Uncategorized';

      categoryMap.set(
        categoryName,
        (categoryMap.get(categoryName) || 0) + revenue,
      );
    });

    const result = Array.from(categoryMap.entries())
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value);

    return result;
  }

  async getCustomerRetentionStats() {
    // Basic retention: % of users with > 1 completed order
    const users = await this.prisma.user.findMany({
      select: {
        _count: {
          select: { orders: { where: { status: 'DELIVERED' } } },
        },
      },
    });

    const totalUsers = users.length;
    if (totalUsers === 0) return { retentionRate: 0, repeatCustomers: 0 };

    const repeatCustomers = users.filter((u) => u._count.orders > 1).length;
    const retentionRate = (repeatCustomers / totalUsers) * 100;

    return {
      retentionRate: Number(retentionRate.toFixed(2)),
      repeatCustomers,
      totalUsers,
    };
  }
}
