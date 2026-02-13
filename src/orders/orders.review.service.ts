import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type OrderItemWithReview = Prisma.OrderItemGetPayload<{
  include: { product: true };
}> & {
  userReview: Prisma.ReviewGetPayload<{}> | null;
};

@Injectable()
export class OrdersReviewService {
  constructor(private prisma: PrismaService) {}

  async attachUserReviews<T extends { items: any[] }>(
    order: T,
    userId?: string | null,
  ): Promise<T & { items: OrderItemWithReview[] }> {
    if (!userId) {
      return {
        ...order,
        items: order.items.map((item) => ({
          ...item,
          userReview: null,
        })),
      };
    }

    const productIds = [...new Set(order.items.map((i) => i.productId))];

    const reviews = await this.prisma.review.findMany({
      where: { userId, productId: { in: productIds } },
    });

    const reviewMap = new Map(reviews.map((r) => [r.productId, r]));

    return {
      ...order,
      items: order.items.map((item) => ({
        ...item,
        userReview: reviewMap.get(item.productId) ?? null,
      })),
    };
  }
}
