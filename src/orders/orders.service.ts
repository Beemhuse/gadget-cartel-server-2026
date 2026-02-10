import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Resend } from 'resend';

@Injectable()
export class OrdersService {
  private resend: Resend;

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  private buildOrderSummary(order: any) {
    const items = order?.items || [];
    const subtotal =
      Number(order?.subtotal) ||
      items.reduce((acc: number, item: any) => {
        const unitPrice = Number(item?.price ?? item?.unit_price ?? 0);
        return acc + unitPrice * Number(item?.quantity ?? 0);
      }, 0);

    const taxAmount = Number(order?.taxAmount ?? 0);
    const deliveryFee = Number(order?.deliveryFee ?? 0);
    const baseTotal = subtotal + taxAmount + deliveryFee;
    const total = Number(order?.total ?? 0);

    const discountAmount = total > 0 ? Math.max(baseTotal - total, 0) : 0;

    const quantityCount = items.reduce(
      (acc: number, item: any) => acc + Number(item?.quantity ?? 0),
      0,
    );

    return {
      subtotal,
      taxAmount,
      deliveryFee,
      discountAmount,
      couponAmount: 0,
      total: total || Math.max(baseTotal - discountAmount, 0),
      itemCount: items.length,
      quantityCount,
    };
  }

  async findAll(userId: string) {
    return this.prisma.order.findMany({
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
    });
  }

  async findAllForUser(userId: string, query: any = {}) {
    const { page, page_size } = query ?? {};
    if (!page || !page_size) {
      return this.findAll(userId);
    }

    const skip = (Number(page) - 1) * Number(page_size);
    const take = Number(page_size);

    const [results, count] = await Promise.all([
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

    return {
      results,
      count,
      page: Number(page),
      page_size: Number(page_size),
    };
  }

  async findOneForUser(id: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
        address: true,
        payment: true,
      },
    });
    if (!order) return order;
    return { ...order, summary: this.buildOrderSummary(order) };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
        address: true,
        payment: true,
      },
    });
    if (!order) return order;
    return { ...order, summary: this.buildOrderSummary(order) };
  }

  async findOneAdmin(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
        address: true,
        payment: true,
      },
    });
    if (!order) return order;
    return { ...order, summary: this.buildOrderSummary(order) };
  }

  async create(userId: string, data: any) {
    const { billing_address_id, delivery_type, coupon_code } = data;

    // 1. Get user's cart
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    const billingAddress = await this.prisma.address.findFirst({
      where: { id: billing_address_id, userId },
    });

    if (!billingAddress) {
      throw new Error('Billing address not found');
    }

    // 2. Calculate totals
    let subtotal = 0;
    let discountAmount = 0;
    const orderItemsData = cart.items.map((item) => {
      const itemPrice = Number(
        (item.metadata as any)?.storagePrice || item.product.price,
      );
      subtotal += itemPrice * item.quantity;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: itemPrice,
        metadata: item.metadata || {},
      };
    });

    // Handle coupon if any (simplified)
    if (coupon_code && coupon_code.trim()) {
      const coupon = await this.prisma.coupon.findUnique({
        where: { code: coupon_code },
      });
      if (coupon && coupon.isActive) {
        if (coupon.discountType === 'percentage') {
          const percentDiscount =
            (subtotal * Number(coupon.discountValue || 0)) / 100;
          const maxDiscount = Number(coupon.maximumDiscount || 0);
          discountAmount =
            maxDiscount > 0
              ? Math.min(percentDiscount, maxDiscount)
              : percentDiscount;
        } else {
          discountAmount = Number(coupon.discountValue || 0);
        }
      }
    }

    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    let deliveryFee = 0;
    if (delivery_type === 'home_delivery') {
      const state = (billingAddress.state || '').toLowerCase();
      const isLagos = state.includes('lagos');
      if (!isLagos) {
        const method = await this.prisma.deliveryMethod.findFirst({
          where: { type: 'DELIVERY', isActive: true },
        });
        deliveryFee = Number(method?.price || 0);
      }
    }

    const taxAmount = 0;
    const total =
      Math.max(subtotal - discountAmount, 0) + deliveryFee + taxAmount;

    // 3. Create Order
    const order = await this.prisma.order.create({
      data: {
        userId,
        addressId: billing_address_id,
        deliveryType: delivery_type,
        subtotal,
        taxAmount,
        deliveryFee,
        total: total,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        items: {
          create: orderItemsData,
        },
      },
    });

    // 4. Clear Cart
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return order;
  }

  // Admin methods
  async findAllAdmin(query: any) {
    const { page = 1, page_size = 10 } = query;
    const skip = (Number(page) - 1) * Number(page_size);
    const take = Number(page_size);

    const [results, count] = await Promise.all([
      this.prisma.order.findMany({
        include: {
          user: true,
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
      this.prisma.order.count(),
    ]);

    return {
      results,
      count,
      page: Number(page),
      page_size: Number(page_size),
    };
  }

  async findAllForCustomerAdmin(userId: string, query: any = {}) {
    const { page = 1, page_size = 10 } = query;
    const skip = (Number(page) - 1) * Number(page_size);
    const take = Number(page_size);

    const [results, count] = await Promise.all([
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

    return {
      results,
      count,
      page: Number(page),
      page_size: Number(page_size),
    };
  }

  async update(id: string, data: any) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
        address: true,
        payment: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const normalizeStatus = (value?: string) =>
      value ? String(value).toUpperCase() : undefined;

    const nextStatus = normalizeStatus(data.status || data.order_status);
    const nextPaymentStatus = normalizeStatus(
      data.payment_status || data.paymentStatus,
    );
    const nextDeliveryStatus = normalizeStatus(
      data.delivery_status || data.deliveryStatus,
    );

    const updateData: any = {
      status: nextStatus ?? order.status,
      paymentStatus: nextPaymentStatus ?? order.paymentStatus,
      deliveryStatus: nextDeliveryStatus ?? order.deliveryStatus,
      deliveryType: data.delivery_type || data.deliveryType || order.deliveryType,
      deliveryDate:
        data.delivery_date || data.deliveryDate || order.deliveryDate,
      shippingDate:
        data.shipping_date || data.shippingDate || order.shippingDate,
      deliveredAt:
        data.delivered_at || data.deliveredAt || order.deliveredAt,
      trackingCode: data.tracking_code || data.trackingCode || order.trackingCode,
      total: data.total || data.total_amount || order.total,
      subtotal: data.subtotal ?? order.subtotal,
      taxAmount: data.tax_amount || data.taxAmount || order.taxAmount,
      deliveryFee: data.delivery_fee || data.deliveryFee || order.deliveryFee,
    };

    const now = new Date();
    if (
      nextDeliveryStatus === 'IN_TRANSIT' &&
      !updateData.shippingDate
    ) {
      updateData.shippingDate = now;
    }
    if (
      nextDeliveryStatus === 'DELIVERED' &&
      !updateData.deliveredAt
    ) {
      updateData.deliveredAt = now;
      if (!updateData.deliveryDate) {
        updateData.deliveryDate = now;
      }
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: updateData,
    });

    const previousDelivery = (order.deliveryStatus || '').toUpperCase();
    const previousStatus = (order.status || '').toUpperCase();
    const currentDelivery = (updateData.deliveryStatus || '').toUpperCase();
    const currentStatus = (updateData.status || '').toUpperCase();

    const orderNumber = order.id.slice(0, 8).toUpperCase();
    const shouldSendInTransit =
      currentDelivery === 'IN_TRANSIT' && previousDelivery !== 'IN_TRANSIT';
    const shouldSendDelivered =
      (currentDelivery === 'DELIVERED' &&
        previousDelivery !== 'DELIVERED') ||
      (currentStatus === 'DELIVERED' && previousStatus !== 'DELIVERED');

    if (order.userId && order.user?.email) {
      if (shouldSendInTransit) {
        await this.sendOrderReceiptEmail(
          { ...order, ...updatedOrder },
          'in_transit',
        );
        await this.notificationsService.createNotification({
          userId: order.userId,
          title: 'Order is in transit',
          message: `Your order #${orderNumber} is now in transit. A receipt has been sent to your email.`,
          type: 'ORDER',
        });
      }

      if (shouldSendDelivered) {
        await this.sendOrderReceiptEmail(
          { ...order, ...updatedOrder },
          'delivered',
        );
        await this.notificationsService.createNotification({
          userId: order.userId,
          title: 'Order delivered',
          message: `Your order #${orderNumber} has been delivered. A receipt has been sent to your email.`,
          type: 'ORDER',
        });
      }
    }

    return updatedOrder;
  }

  private formatCurrency(value: number) {
    const numeric = Number(value || 0);
    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(numeric);
    } catch {
      return `NGN ${numeric.toFixed(2)}`;
    }
  }

  private buildReceiptHtml(order: any, status: 'in_transit' | 'delivered') {
    const items = order?.items || [];
    const subtotal =
      Number(order?.subtotal) ||
      items.reduce((acc: number, item: any) => {
        const unitPrice = Number(item?.price ?? 0);
        return acc + unitPrice * Number(item?.quantity ?? 0);
      }, 0);
    const taxAmount = Number(order?.taxAmount ?? 0);
    const deliveryFee = Number(order?.deliveryFee ?? 0);
    const total = Number(order?.total ?? 0);
    const baseTotal = subtotal + taxAmount + deliveryFee;
    const discountAmount =
      total > 0 ? Math.max(baseTotal - total, 0) : 0;
    const orderNumber = order?.id
      ? String(order.id).slice(0, 8).toUpperCase()
      : 'N/A';

    const rows = items
      .map((item: any) => {
        const name = item?.product?.name || 'Product';
        const quantity = Number(item?.quantity ?? 0);
        const price = Number(item?.price ?? 0);
        const lineTotal = price * quantity;
        return `
          <tr>
            <td style="padding:8px 0;">${name}</td>
            <td style="padding:8px 0; text-align:center;">${quantity}</td>
            <td style="padding:8px 0; text-align:right;">${this.formatCurrency(
              price,
            )}</td>
            <td style="padding:8px 0; text-align:right;">${this.formatCurrency(
              lineTotal,
            )}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
        <h2 style="margin-bottom: 4px;">Your order is ${
          status === 'delivered' ? 'delivered' : 'in transit'
        }</h2>
        <p style="margin-top: 0;">Order #${orderNumber}</p>
        <p>Thanks for shopping with us. Here is your receipt:</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 12px;">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px 0; border-bottom:1px solid #e5e7eb;">Item</th>
              <th style="text-align:center; padding:8px 0; border-bottom:1px solid #e5e7eb;">Qty</th>
              <th style="text-align:right; padding:8px 0; border-bottom:1px solid #e5e7eb;">Unit</th>
              <th style="text-align:right; padding:8px 0; border-bottom:1px solid #e5e7eb;">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top: 16px;">
          <p style="margin: 4px 0;">Subtotal: ${this.formatCurrency(
            subtotal,
          )}</p>
          <p style="margin: 4px 0;">Delivery: ${this.formatCurrency(
            deliveryFee,
          )}</p>
          <p style="margin: 4px 0;">Tax: ${this.formatCurrency(
            taxAmount,
          )}</p>
          <p style="margin: 4px 0;">Discount: -${this.formatCurrency(
            discountAmount,
          )}</p>
          <p style="margin: 8px 0; font-weight: bold;">Total: ${this.formatCurrency(
            total || baseTotal,
          )}</p>
        </div>
      </div>
    `;
  }

  private async sendOrderReceiptEmail(
    order: any,
    status: 'in_transit' | 'delivered',
  ) {
    const email = order?.user?.email;
    if (!email) return;
    if (!process.env.RESEND_API_KEY) {
      console.log(`[DEV EMAIL] Receipt email not sent (missing RESEND_API_KEY).`);
      return;
    }

    const html = this.buildReceiptHtml(order, status);
    const orderNumber = order?.id
      ? String(order.id).slice(0, 8).toUpperCase()
      : 'Order';

    await this.resend.emails.send({
      from: 'Gadget Cartel <onboarding@resend.dev>',
      to: email,
      subject:
        status === 'delivered'
          ? `Order #${orderNumber} delivered`
          : `Order #${orderNumber} is in transit`,
      html,
    });
  }
}
