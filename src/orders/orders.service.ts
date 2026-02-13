import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersSummaryService } from './orders.summary.service';
import { OrdersReviewService } from './orders.review.service';
import { OrdersEmailService } from './orders.email.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private summaryService: OrdersSummaryService,
    private reviewService: OrdersReviewService,
    private emailService: OrdersEmailService,
    private notificationsService: NotificationsService,
  ) {}

  async findOneForUser(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: {
        user: true,
        items: { include: { product: { include: { images: true } } } },
        address: true,
        payment: true,
      },
    });

    if (!order) return null;

    const withReviews = await this.reviewService.attachUserReviews(
      order,
      userId,
    );

    return {
      ...withReviews,
      summary: this.summaryService.build(withReviews),
    };
  }

  async updateStatus(id: string, status: 'IN_TRANSIT' | 'DELIVERED') {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: { include: { product: true } },
      },
    });

    if (!order) throw new Error('Order not found');

    await this.prisma.order.update({
      where: { id },
      data: { deliveryStatus: status },
    });

    await this.emailService.sendReceipt(
      { ...order, user: order.user ?? undefined },
      status === 'DELIVERED' ? 'delivered' : 'in_transit',
    );

    if (order.userId) {
      await this.notificationsService.createNotification({
        userId: order.userId,
        title: `Order ${status}`,
        message: `Your order has been ${status.toLowerCase()}`,
        type: 'ORDER',
      });
    }

    return { success: true };
  }

  // Missing methods implementation

  async findAll(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: { include: { product: true } },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: { include: { product: { include: { images: true } } } },
        address: true,
        payment: true,
      },
    });

    if (!order) return null;

    // Use empty string or handle null user for reviews (might affect logic but prevents crash)
    const userId = order.userId || '';
    const withReviews = await this.reviewService.attachUserReviews(
      order,
      userId,
    );

    return {
      ...withReviews,
      summary: this.summaryService.build(withReviews),
    };
  }

  async create(userId: string, body: any) {
    // Basic implementation using Cart
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Calculate totals
    const items = cart.items.map((item) => ({
      price: Number(item.product.price),
      quantity: item.quantity,
    }));

    const summary = this.summaryService.build({ items });

    // Create order
    const order = await this.prisma.order.create({
      data: {
        userId,
        total: summary.total,
        subtotal: summary.subtotal,
        taxAmount: summary.taxAmount,
        deliveryFee: summary.deliveryFee,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price,
            metadata: item.metadata || undefined,
          })),
        },
        // Handle address, etc. from body if needed
      },
      include: { items: true },
    });

    // Clear cart
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    // Send Notification
    await this.notificationsService.createNotification({
      userId,
      title: 'Order Placed',
      message: `Order #${order.id} has been placed successfully`,
      type: 'ORDER',
    });

    return order;
  }

  async quoteShipping(userId: string, body: any) {
    // Mock implementation
    return {
      shippingMethods: [
        { id: '1', name: 'Standard Shipping', price: 10, estimatedDays: '3-5' },
        { id: '2', name: 'Express Shipping', price: 25, estimatedDays: '1-2' },
      ],
    };
  }

  async findAllForUser(userId: string, query: any) {
    return this.findAll(userId);
  }

  async findAllForCustomerAdmin(userId: string, query: any) {
    // In admin context, userId refers to the customer's ID
    return this.findAll(userId);
  }

  async findAllAdmin(query: any) {
    return this.prisma.order.findMany({
      include: {
        user: true,
        items: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneAdmin(id: string) {
    return this.findOne(id);
  }

  async update(id: string, body: any) {
    return this.prisma.order.update({
      where: { id },
      data: body,
    });
  }
}
