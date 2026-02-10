import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        addresses: true,
      },
    });
  }

  async findAllAdmin(query: any) {
    const { page = 1, page_size = 10 } = query;
    const skip = (Number(page) - 1) * Number(page_size);
    const take = Number(page_size);

    const [results, count] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        include: {
          addresses: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      results,
      count,
      page: Number(page),
      page_size: Number(page_size),
    };
  }

  async findAdminDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        country: true,
        state: true,
        picture: true,
        createdAt: true,
        lastLogin: true,
        isVerified: true,
        addresses: true,
        orders: {
          select: {
            id: true,
            total: true,
            status: true,
            deliveryStatus: true,
            items: {
              select: {
                quantity: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    const orders = user.orders || [];
    const totalOrders = orders.length;
    const totalAmountSpent = orders.reduce(
      (acc, order) => acc + Number(order.total || 0),
      0,
    );
    const totalProducts = orders.reduce((acc, order) => {
      const itemCount = order.items?.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      );
      return acc + Number(itemCount || 0);
    }, 0);

    const deliveredCount = orders.filter((order) => {
      const status = (
        order.deliveryStatus ||
        order.status ||
        ''
      ).toLowerCase();
      return status === 'delivered';
    }).length;

    const pendingCount = orders.filter((order) => {
      const status = (
        order.deliveryStatus ||
        order.status ||
        ''
      ).toLowerCase();
      if (!status) return true;
      if (status === 'delivered') return false;
      if (status === 'cancelled' || status === 'failed') return false;
      return true;
    }).length;

    return {
      customer: {
        id: user.id,
        email: user.email,
        name: user.name,
        full_name: user.name,
        phone: user.phone,
        phone_number: user.phone,
        country: user.country,
        state: user.state,
        picture: user.picture,
        image: user.picture,
        avatar: user.picture,
        createdAt: user.createdAt,
        created_at: user.createdAt,
        lastLogin: user.lastLogin,
        last_login: user.lastLogin,
        isVerified: user.isVerified,
        is_active: user.isVerified,
        isActive: user.isVerified,
        addresses: user.addresses,
        total_orders: totalOrders,
        total_amount_spent: totalAmountSpent,
        total_products: totalProducts,
        delivery_delivered_count: deliveredCount,
        delivery_pending_count: pendingCount,
      },
    };
  }

  async update(id: string, data: any) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }
}
