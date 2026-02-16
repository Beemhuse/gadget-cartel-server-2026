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
    const rawCode = typeof body?.coupon_code === 'string' ? body.coupon_code : '';
    const couponCode = rawCode.trim();
    const now = new Date();

    const order = await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true } } },
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      let coupon: any = null;
      if (couponCode) {
        coupon = await tx.coupon.findUnique({
          where: { code: couponCode },
        });

        if (!coupon || !coupon.isActive) {
          throw new BadRequestException('Invalid or expired coupon');
        }

        if (coupon.validUntil && coupon.validUntil < now) {
          throw new BadRequestException('Coupon expired');
        }

        if (coupon.validFrom && coupon.validFrom > now) {
          throw new BadRequestException('Coupon not yet active');
        }

        if (coupon.usageLimit && coupon.usageLimit > 0) {
          const usageCount = await tx.couponUsage.count({
            where: { couponId: coupon.id },
          });

          if (usageCount >= coupon.usageLimit) {
            const isExpired = coupon.validUntil && coupon.validUntil < now;
            if (!isExpired && coupon.isActive) {
              await tx.coupon.update({
                where: { id: coupon.id },
                data: { isActive: false },
              });
            }
            throw new BadRequestException('Coupon usage limit reached');
          }
        }

        if (coupon.usageLimitPerUser && coupon.usageLimitPerUser > 0) {
          const userUsageCount = await tx.couponUsage.count({
            where: { couponId: coupon.id, userId },
          });

          if (userUsageCount >= coupon.usageLimitPerUser) {
            throw new BadRequestException(
              'Coupon usage limit reached for this user',
            );
          }
        }
      }

      const toNumber = (value: any) => {
        if (value === null || value === undefined || value === '') return 0;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const calculateCouponDiscount = (couponRow: any, subtotal: number) => {
        if (!couponRow) return 0;
        if (subtotal <= 0) return 0;

        const discountType =
          couponRow.discountType ?? couponRow.discount_type ?? 'percentage';
        const discountValue = toNumber(
          couponRow.discountValue ?? couponRow.discount_value,
        );
        const maximumDiscount = toNumber(
          couponRow.maximumDiscount ?? couponRow.maximum_discount,
        );

        let discount = 0;
        if (discountType === 'percentage') {
          discount = (subtotal * discountValue) / 100;
          if (maximumDiscount > 0) {
            discount = Math.min(discount, maximumDiscount);
          }
        } else if (discountType === 'fixed') {
          discount = discountValue;
        }

        if (!Number.isFinite(discount)) return 0;
        return Math.max(Math.min(discount, subtotal), 0);
      };

      // Calculate totals
      const items = cart.items.map((item) => ({
        price: Number(item.product.price),
        quantity: item.quantity,
      }));

      const summary = this.summaryService.build({ items });
      const baseSubtotal = toNumber(summary.subtotal);
      const baseTotal = toNumber(summary.total);

      let couponDiscount = 0;
      if (coupon) {
        const minimumOrderAmount = toNumber(
          coupon.minimumOrderAmount ?? coupon.minimum_order_amount,
        );
        if (minimumOrderAmount > 0 && baseSubtotal < minimumOrderAmount) {
          throw new BadRequestException(
            'Minimum order amount not met for this coupon',
          );
        }
        couponDiscount = calculateCouponDiscount(coupon, baseSubtotal);
      }

      const finalTotal = Math.max(baseTotal - couponDiscount, 0);

      // Create order
      const order = await tx.order.create({
        data: {
          userId,
          total: finalTotal,
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

      if (coupon) {
        await tx.couponUsage.create({
          data: {
            couponId: coupon.id,
            userId,
            orderId: order.id,
          },
        });

        const updatedCoupon = await tx.coupon.update({
          where: { id: coupon.id },
          data: { usageCount: { increment: 1 } },
        });

        if (
          updatedCoupon.usageLimit &&
          updatedCoupon.usageLimit > 0 &&
          updatedCoupon.usageCount >= updatedCoupon.usageLimit &&
          updatedCoupon.isActive
        ) {
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { isActive: false },
          });
        }
      }

      // Clear cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });

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
