import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Resend } from 'resend';

import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

type ShippingAddress = {
  city?: string | null;
  state?: string | null;
};
type OrderItemInput = {
  price?: number | string | Prisma.Decimal;
  unit_price?: number | string | Prisma.Decimal;
  quantity?: number | string;
};

type OrderSummarySource = {
  items?: OrderItemInput[];
  subtotal?: number | string | Prisma.Decimal | null;
  taxAmount?: number | string | Prisma.Decimal | null;
  deliveryFee?: number | string | Prisma.Decimal | null;
  total?: number | string | Prisma.Decimal | null;
};

type OrderSummary = {
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  discountAmount: number;
  couponAmount: number;
  total: number;
  itemCount: number;
  quantityCount: number;
};

type QuoteShippingPayload = {
  address_id: string;
  delivery_type: string;
  zone_id?: string;
  delivery_method_id?: string;
  order_total: number;
};

type ShippingQuote = {
  shippingFee: number;
  basePrice: number;
  freeOver: number | null;
  zoneId: string | null;
  zoneName: string | null;
  deliveryMethodId: string | null;
};
// PaginationQuery type kept
type PaginationQuery = {
  page?: string | number;
  page_size?: string | number;
};

type OrderListItem = Prisma.OrderGetPayload<{
  include: {
    items: {
      select: {
        id: true;
        orderId: true;
        productId: true;
        quantity: true;
        price: true;
        product: true;
      };
    };
    address: true;
    payment: true;
  };
}>;

type OrderWithItems = Prisma.OrderGetPayload<{
  include: {
    items: {
      select: {
        id: true;
        orderId: true;
        productId: true;
        quantity: true;
        price: true;
        product: { include: { images: true } };
      };
    };
    address: true;
    payment: true;
  };
}>;

type OrderWithUserSelect = Prisma.OrderGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        email: true;
        phone: true;
      };
    };
    items: {
      select: {
        id: true;
        orderId: true;
        productId: true;
        quantity: true;
        price: true;
        product: { include: { images: true } };
      };
    };
    address: true;
    payment: true;
  };
}>;

type OrderWithFullUser = Prisma.OrderGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        email: true;
        phone: true;
      };
    };
    items: {
      select: {
        id: true;
        orderId: true;
        productId: true;
        quantity: true;
        price: true;
        product: { include: { images: true } };
      };
    };
    address: true;
    payment: true;
  };
}>;

type OrderReceiptItem = {
  product?: { name?: string | null } | null;
  price?: number | string | null;
  quantity?: number | string | null;
};

type OrderReceiptPayload = {
  items: OrderReceiptItem[];
  subtotal?: number | string | null;
  taxAmount?: number | string | null;
  deliveryFee?: number | string | null;
  total?: number | string | null;
  id?: string | null;
  user?: { email?: string | null } | null;
};

@Injectable()
export class OrdersService {
  private resend: Resend;

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  private toNum(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (val instanceof Prisma.Decimal) return val.toNumber();
    return Number(val) || 0;
  }

  private buildOrderSummary(order: OrderSummarySource): OrderSummary {
    const items: OrderItemInput[] = order.items ?? [];

    // ✅ Calculate subtotal if not provided
    const calculatedSubtotal = items.reduce((acc, item) => {
      const unitPrice = this.toNum(item.price ?? item.unit_price);
      const quantity = Number(item.quantity ?? 0);
      return acc + unitPrice * quantity;
    }, 0);

    const subtotal =
      order.subtotal !== undefined && order.subtotal !== null
        ? this.toNum(order.subtotal)
        : calculatedSubtotal;

    const taxAmount = this.toNum(order.taxAmount);
    const deliveryFee = this.toNum(order.deliveryFee);

    const baseTotal = subtotal + taxAmount + deliveryFee;

    const providedTotal = this.toNum(order.total);

    const discountAmount =
      providedTotal > 0 ? Math.max(baseTotal - providedTotal, 0) : 0;

    const quantityCount = items.reduce(
      (acc, item) => acc + Number(item.quantity ?? 0),
      0,
    );

    const total =
      providedTotal > 0
        ? providedTotal
        : Math.max(baseTotal - discountAmount, 0);

    return {
      subtotal,
      taxAmount,
      deliveryFee,
      discountAmount,
      couponAmount: 0,
      total,
      itemCount: items.length,
      quantityCount,
    };
  }

  private normalizeLocation(value?: string | null): string | null {
    if (!value) return null;

    return value.trim().toLowerCase();
  }

  private async findShippingZone(address: ShippingAddress) {
    const city = this.normalizeLocation(address.city);
    const state = this.normalizeLocation(address.state);

    // State is REQUIRED for shipping
    if (!state) return null;

    // 1️⃣ Try city-level match first
    if (city) {
      const cityMatch = await this.prisma.shippingZone.findFirst({
        where: {
          isActive: true,
          state: {
            equals: state,
            mode: 'insensitive',
          },
          city: {
            equals: city,
            mode: 'insensitive',
          },
        },
      });

      if (cityMatch) return cityMatch;
    }

    // 2️⃣ Fallback to state-wide zone
    return this.prisma.shippingZone.findFirst({
      where: {
        isActive: true,
        state: {
          equals: state,
          mode: 'insensitive',
        },
        OR: [{ city: null }, { city: '' }],
      },
    });
  }

  private async resolveShippingFee(params: {
    address?: ShippingAddress;
    deliveryType?: string;
    deliveryMethodId?: string;
    zoneId?: string | null;
    orderTotal: number;
  }): Promise<ShippingQuote> {
    const deliveryType = (params.deliveryType || '').toLowerCase();
    if (deliveryType === 'pick_up_from_store' || deliveryType === 'pickup') {
      return {
        shippingFee: 0,
        basePrice: 0,
        freeOver: null,
        zoneId: null,
        zoneName: null,
        deliveryMethodId: params.deliveryMethodId || null,
      };
    }

    const method = params.deliveryMethodId
      ? await this.prisma.deliveryMethod.findFirst({
          where: { id: params.deliveryMethodId, isActive: true },
        })
      : await this.prisma.deliveryMethod.findFirst({
          where: { type: 'DELIVERY', isActive: true },
        });

    const fallbackPrice = this.toNum(method?.price);
    if (!params.address || !method) {
      return {
        shippingFee: fallbackPrice,
        basePrice: fallbackPrice,
        freeOver: null,
        zoneId: null,
        zoneName: null,
        deliveryMethodId: method?.id || null,
      };
    }

    let zone: any = null;
    if (params.zoneId) {
      zone = await this.prisma.shippingZone.findFirst({
        where: { id: params.zoneId, isActive: true },
      });
      if (!zone) {
        throw new Error('Shipping zone not found');
      }
    } else {
      zone = await this.findShippingZone(params.address);
    }
    if (!zone) {
      return {
        shippingFee: fallbackPrice,
        basePrice: fallbackPrice,
        freeOver: null,
        zoneId: null,
        zoneName: null,
        deliveryMethodId: method?.id || null,
      };
    }

    const shippingPrice = await this.prisma.shippingPrice.findFirst({
      where: {
        zoneId: zone.id,
        deliveryMethodId: method.id,
        isActive: true,
      },
    });

    if (!shippingPrice) {
      return {
        shippingFee: fallbackPrice,
        basePrice: fallbackPrice,
        freeOver: null,
        zoneId: zone.id,
        zoneName: zone.name,
        deliveryMethodId: method?.id || null,
      };
    }

    const freeOver = this.toNum(shippingPrice.freeOver);
    const basePrice = this.toNum(shippingPrice.price);
    const shippingFee =
      freeOver > 0 && params.orderTotal >= freeOver ? 0 : basePrice;

    return {
      shippingFee,
      basePrice,
      freeOver,
      zoneId: zone.id,
      zoneName: zone.name,
      deliveryMethodId: method.id,
    };
  }

  async findAll(userId: string): Promise<OrderListItem[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          select: {
            id: true,
            orderId: true,
            productId: true,
            quantity: true,
            price: true,
            product: true,
            // Exclude metadata
          },
        },
        address: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders as any;
  }

  async findAllForUser(
    userId: string,
    query: PaginationQuery = {},
  ): Promise<
    | OrderListItem[]
    | {
        results: OrderListItem[];
        count: number;
        page: number;
        page_size: number;
      }
  > {
    const page = query.page ? Number(query.page) : undefined;
    const pageSize = query.page_size ? Number(query.page_size) : undefined;

    // If pagination not provided → return all
    if (!page || !pageSize) {
      return this.findAll(userId);
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [results, count] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            select: {
              id: true,
              orderId: true,
              productId: true,
              quantity: true,
              price: true,
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
      this.prisma.order.count({
        where: { userId },
      }),
    ]);

    return {
      results: results as any,
      count,
      page,
      page_size: pageSize,
    };
  }

  async findOneForUser(
    id: string,
    userId: string,
  ): Promise<(OrderWithUserSelect & { summary: OrderSummary }) | null> {
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
          select: {
            id: true,
            orderId: true,
            productId: true,
            quantity: true,
            price: true,
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
    if (!order) return null;
    return { ...order, summary: this.buildOrderSummary(order as any) } as any;
  }

  async findOne(
    id: string,
  ): Promise<(OrderWithItems & { summary: OrderSummary }) | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          select: {
            id: true,
            orderId: true,
            productId: true,
            quantity: true,
            price: true,
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
    if (!order) return null;
    return { ...order, summary: this.buildOrderSummary(order as any) } as any;
  }

  async findOneAdmin(
    id: string,
  ): Promise<(OrderWithFullUser & { summary: OrderSummary }) | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            // Exclude password
          },
        },
        items: {
          select: {
            id: true,
            orderId: true,
            productId: true,
            quantity: true,
            price: true,
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
    if (!order) return null;
    return { ...order, summary: this.buildOrderSummary(order as any) } as any;
  }

  async create(userId: string, data: CreateOrderDto) {
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
      const itemPrice = this.toNum(item.product.price);
      subtotal += itemPrice * item.quantity;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: itemPrice,
        metadata: item.metadata || {},
      };
    });

    // Handle coupon if any (simplified)
    let appliedCouponId: string | null = null;
    let appliedCouponUsageLimit: number | null = null;
    let appliedCouponValidUntil: Date | null = null;
    let appliedCouponUsageCount = 0;

    if (coupon_code && coupon_code.trim()) {
      const coupon: any = await this.prisma.coupon.findUnique({
        where: { code: coupon_code },
      });
      if (coupon && coupon.isActive) {
        appliedCouponUsageCount = Number(coupon.usageCount || 0);
        appliedCouponUsageLimit =
          coupon.usageLimit && coupon.usageLimit > 0 ? coupon.usageLimit : null;
        appliedCouponValidUntil = coupon.validUntil ?? null;
        if (coupon.validUntil && coupon.validUntil < new Date()) {
          throw new Error('Coupon expired');
        }
        if (coupon.validFrom && coupon.validFrom > new Date()) {
          throw new Error('Coupon not yet active');
        }
        if (coupon.usageLimit && coupon.usageLimit > 0) {
          const usageCount = await this.prisma.couponUsage.count({
            where: { couponId: coupon.id },
          });
          if (usageCount >= coupon.usageLimit) {
            throw new Error('Coupon usage limit reached');
          }
          appliedCouponUsageCount = usageCount;
        }
        if (coupon.usageLimitPerUser && coupon.usageLimitPerUser > 0) {
          const userUsageCount = await this.prisma.couponUsage.count({
            where: { couponId: coupon.id, userId },
          });
          if (userUsageCount >= coupon.usageLimitPerUser) {
            throw new Error('Coupon usage limit reached');
          }
        }

        const couponDiscountVal = this.toNum(coupon.discountValue);
        const couponMaxDiscount = this.toNum(coupon.maximumDiscount);

        if (coupon.discountType === 'percentage') {
          const percentDiscount = (subtotal * couponDiscountVal) / 100;
          discountAmount =
            couponMaxDiscount > 0
              ? Math.min(percentDiscount, couponMaxDiscount)
              : percentDiscount;
        } else {
          discountAmount = couponDiscountVal;
        }
        appliedCouponId = coupon.id;
      }
    }

    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }

    const taxAmount = 0;
    const orderTotal = Math.max(subtotal - discountAmount, 0) + taxAmount;

    const normalizedDeliveryType = String(delivery_type || '').toLowerCase();
    const zoneId = data.zone_id;
    if (normalizedDeliveryType === 'home_delivery' && !zoneId) {
      throw new Error('Shipping zone is required for home_delivery');
    }

    const shippingQuote = await this.resolveShippingFee({
      address: billingAddress,
      deliveryType: delivery_type,
      deliveryMethodId: data.delivery_method_id,
      zoneId,
      orderTotal,
    });

    const deliveryFee = this.toNum(shippingQuote?.shippingFee);
    const total = orderTotal + deliveryFee;

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

    if (appliedCouponId) {
      await this.prisma.couponUsage.create({
        data: {
          couponId: appliedCouponId,
          userId,
          orderId: order.id,
        },
      });

      const nextUsageCount = appliedCouponUsageCount + 1;
      const shouldDisable =
        appliedCouponUsageLimit !== null &&
        appliedCouponUsageLimit > 0 &&
        nextUsageCount >= appliedCouponUsageLimit &&
        (!appliedCouponValidUntil || appliedCouponValidUntil >= new Date());

      await this.prisma.coupon.update({
        where: { id: appliedCouponId },
        data: {
          usageCount: nextUsageCount,
          ...(shouldDisable ? { isActive: false } : {}),
        } as any,
      });
    }

    // 4. Clear Cart
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return order;
  }

  // Admin methods
  async findAllAdmin(query: PaginationQuery = {}) {
    const { page = 1, page_size = 10 } = query;
    const skip = (Number(page) - 1) * Number(page_size);
    const take = Number(page_size);

    const [results, count] = await Promise.all([
      this.prisma.order.findMany({
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
            select: {
              id: true,
              orderId: true,
              productId: true,
              quantity: true,
              price: true,
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
      results: results as any,
      count,
      page: Number(page),
      page_size: Number(page_size),
    };
  }

  async findAllForCustomerAdmin(userId: string, query: PaginationQuery = {}) {
    const page = query.page ? Number(query.page) : 1;
    const pageSize = query.page_size ? Number(query.page_size) : 10;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [results, count] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        include: {
          items: {
            select: {
              id: true,
              orderId: true,
              productId: true,
              quantity: true,
              price: true,
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
      results: results as any,
      count,
      page: Number(page),
      page_size: Number(pageSize),
    };
  }

  async update(id: string, data: UpdateOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
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
          select: {
            id: true,
            orderId: true,
            productId: true,
            quantity: true,
            price: true,
            product: {
              select: {
                name: true,
              },
            },
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

    const nextStatus = normalizeStatus(data.status);
    const nextPaymentStatus = normalizeStatus(
      data.payment_status || data.paymentStatus,
    );
    const nextDeliveryStatus = normalizeStatus(
      data.delivery_status || data.deliveryStatus,
    );

    const updateData = {
      status: nextStatus ?? order.status,
      paymentStatus: nextPaymentStatus ?? order.paymentStatus,
      deliveryStatus: nextDeliveryStatus ?? order.deliveryStatus,

      deliveryType: data.deliveryType, // DTO doesn't have delivery_type/DeliveryType mess hopefully, checking DTO again.

      deliveryDate:
        data.delivery_date ?? data.deliveryDate ?? order.deliveryDate,

      shippingDate:
        data.shipping_date ?? data.shippingDate ?? order.shippingDate,

      deliveredAt: data.delivered_at ?? data.deliveredAt ?? order.deliveredAt,

      trackingCode:
        data.tracking_code ?? data.trackingCode ?? order.trackingCode,
    };

    const now = new Date();

    if (nextDeliveryStatus === 'IN_TRANSIT' && !updateData.shippingDate) {
      updateData.shippingDate = now;
    }

    if (nextDeliveryStatus === 'DELIVERED' && !updateData.deliveredAt) {
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
      (currentDelivery === 'DELIVERED' && previousDelivery !== 'DELIVERED') ||
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

  async quoteShipping(
    userId: string,
    data: {
      address_id: string;
      delivery_type: string;
      zone_id?: string;
      delivery_method_id?: string;
      order_total: number;
    },
  ) {
    const addressId = data.address_id;
    if (!addressId) {
      throw new Error('Address is required');
    }

    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new Error('Address not found');
    }

    const orderTotal = Number(data.order_total || 0);
    const quote = await this.resolveShippingFee({
      address,
      deliveryType: data.delivery_type,
      deliveryMethodId: data.delivery_method_id,
      zoneId: data.zone_id,
      orderTotal,
    });

    return {
      shippingFee: quote.shippingFee,
      basePrice: quote.basePrice,
      freeOver: quote.freeOver,
      zoneId: quote.zoneId,
      zoneName: quote.zoneName,
      deliveryMethodId: quote.deliveryMethodId,
    };
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

  private buildReceiptHtml(
    order: {
      items: any[];
      subtotal?: number;
      taxAmount?: number;
      deliveryFee?: number;
      total?: number;
      id?: string;
    },
    status: 'in_transit' | 'delivered',
  ) {
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
    const discountAmount = total > 0 ? Math.max(baseTotal - total, 0) : 0;
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
          <p style="margin: 4px 0;">Tax: ${this.formatCurrency(taxAmount)}</p>
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
      console.log(
        `[DEV EMAIL] Receipt email not sent (missing RESEND_API_KEY).`,
      );
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
