import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

type PaginationQuery = {
  page?: string | number;
  page_size?: string | number;
};

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, payload: CreateReviewDto) {
    const productId = payload.productId;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const hasOrdered = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId },
      },
      select: { id: true },
    });

    if (!hasOrdered) {
      throw new BadRequestException(
        'You can only review products you have purchased',
      );
    }

    const existing = await this.prisma.review.findFirst({
      where: { userId, productId },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('You already reviewed this product');
    }

    return this.prisma.review.create({
      data: {
        userId,
        productId,
        rating: payload.rating,
        comment: payload.comment?.trim() || null,
      },
    });
  }

  async findForProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId },
      include: {
        user: {
          select: {
            name: true,
            googlePic: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForUser(userId: string) {
    return this.prisma.review.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            images: {
              orderBy: { sortOrder: 'asc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllAdmin(query: PaginationQuery = {}) {
    const page = query.page ? Number(query.page) : undefined;
    const pageSize = query.page_size ? Number(query.page_size) : undefined;

    if (!page || !pageSize) {
      return this.prisma.review.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: {
                orderBy: { sortOrder: 'asc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [results, count] = await Promise.all([
      this.prisma.review.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: {
                orderBy: { sortOrder: 'asc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.review.count(),
    ]);

    return {
      results,
      count,
      page,
      page_size: pageSize,
    };
  }
}
