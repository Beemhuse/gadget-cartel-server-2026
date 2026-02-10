import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupons.dto';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 10;
    const skip = (page - 1) * pageSize;

    const [results, count] = await Promise.all([
      this.prisma.coupon.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          applicableProducts: { select: { id: true, name: true } },
          applicableCategories: { select: { id: true, name: true } },
          assignedUsers: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.coupon.count(),
    ]);

    return {
      results,
      count,
      page,
      page_size: pageSize,
    };
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        applicableProducts: { select: { id: true, name: true } },
        applicableCategories: { select: { id: true, name: true } },
        assignedUsers: { select: { id: true, name: true, email: true } },
      },
    });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return coupon;
  }

  async create(data: CreateCouponDto) {
    const { applicableProducts, applicableCategories, assignedUsers, ...rest } =
      data;

    return this.prisma.coupon.create({
      data: {
        ...rest,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        applicableProducts: applicableProducts
          ? {
              connect: applicableProducts.map((id) => ({ id })),
            }
          : undefined,
        applicableCategories: applicableCategories
          ? {
              connect: applicableCategories.map((id) => ({ id })),
            }
          : undefined,
        assignedUsers: assignedUsers
          ? {
              connect: assignedUsers.map((id) => ({ id })),
            }
          : undefined,
      },
    });
  }

  async update(id: string, data: UpdateCouponDto) {
    await this.findOne(id);
    const { applicableProducts, applicableCategories, assignedUsers, ...rest } =
      data;

    const updateData: any = {
      ...rest,
    };

    if (data.validFrom) updateData.validFrom = new Date(data.validFrom);
    if (data.validUntil) updateData.validUntil = new Date(data.validUntil);

    if (applicableProducts) {
      updateData.applicableProducts = {
        set: applicableProducts.map((id) => ({ id })),
      };
    }

    if (applicableCategories) {
      updateData.applicableCategories = {
        set: applicableCategories.map((id) => ({ id })),
      };
    }

    if (assignedUsers) {
      updateData.assignedUsers = {
        set: assignedUsers.map((id) => ({ id })),
      };
    }

    return this.prisma.coupon.update({
      where: { id },
      data: updateData,
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.coupon.update({
      where: { id },
      data: { isActive },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Delete usages first to avoid FK constraint error
        await tx.couponUsage.deleteMany({
          where: { couponId: id },
        });
        return tx.coupon.delete({
          where: { id },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2014')
      ) {
        throw new BadRequestException('Cannot delete used coupon');
      }
      throw error;
    }
  }

  async validate(code: string) {
    const coupon: any = await this.prisma.coupon.findUnique({
      where: { code },
      include: {
        applicableProducts: true,
        applicableCategories: true,
        assignedUsers: true,
      },
    });

    if (!coupon || !coupon.isActive) {
      return { valid: false, message: 'Invalid or expired coupon' };
    }

    if (coupon.validUntil && coupon.validUntil < new Date()) {
      return { valid: false, message: 'Coupon expired' };
    }

    if (coupon.validFrom && coupon.validFrom > new Date()) {
      return { valid: false, message: 'Coupon not yet active' };
    }

    if (coupon.usageLimit && coupon.usageLimit > 0) {
      const usageCount = await this.prisma.couponUsage.count({
        where: { couponId: coupon.id },
      });

      if (usageCount > coupon.usageCount) {
        await this.prisma.coupon.update({
          where: { id: coupon.id },
          data: { usageCount } as any,
        });
      }

      if (usageCount >= coupon.usageLimit) {
        const isExpired = coupon.validUntil && coupon.validUntil < new Date();
        if (!isExpired && coupon.isActive) {
          await this.prisma.coupon.update({
            where: { id: coupon.id },
            data: { isActive: false },
          });
        }
        return { valid: false, message: 'Coupon usage limit reached' };
      }
    }

    return { valid: true, coupon };
  }

  async getUsages(userId: string) {
    // Implement logic to fetch coupon usage history for user
    return [];
  }
}
