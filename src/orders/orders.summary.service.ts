import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrderSummary } from './orders.types';

@Injectable()
export class OrdersSummaryService {
  private toNum(val: unknown): number {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (val instanceof Prisma.Decimal) return val.toNumber();
    return Number(val) || 0;
  }

  build(order: {
    items?: { price: number | Prisma.Decimal; quantity: number }[];
    subtotal?: number | Prisma.Decimal | null;
    taxAmount?: number | Prisma.Decimal | null;
    deliveryFee?: number | Prisma.Decimal | null;
    total?: number | Prisma.Decimal | null;
  }): OrderSummary {
    const items = order.items ?? [];

    const subtotal =
      order.subtotal !== undefined
        ? this.toNum(order.subtotal)
        : items.reduce(
            (acc, item) => acc + this.toNum(item.price) * item.quantity,
            0,
          );

    const taxAmount = this.toNum(order.taxAmount);
    const deliveryFee = this.toNum(order.deliveryFee);
    const baseTotal = subtotal + taxAmount + deliveryFee;
    const providedTotal = this.toNum(order.total);

    const discountAmount =
      providedTotal > 0 ? Math.max(baseTotal - providedTotal, 0) : 0;

    return {
      subtotal,
      taxAmount,
      deliveryFee,
      discountAmount,
      couponAmount: 0,
      total: providedTotal || baseTotal,
      itemCount: items.length,
      quantityCount: items.reduce((a, b) => a + b.quantity, 0),
    };
  }
}
