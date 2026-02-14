import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createNotification(params: {
    userId: string;
    title: string;
    message: string;
    type?: string;
  }) {
    const { userId, title, message, type } = params;
    return this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
      },
    });
  }

  async findAll(userId: string, query?: { page?: any; page_size?: any }) {
    const page = Number(query?.page) || 1;
    const pageSize = Number(query?.page_size) || 10;
    const skip = (page - 1) * pageSize;

    const [results, count] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      results,
      count,
      page,
      page_size: pageSize,
    };
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async remove(id: string) {
    return this.prisma.notification.delete({
      where: { id },
    });
  }
}
