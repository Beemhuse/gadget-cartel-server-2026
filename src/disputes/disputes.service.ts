import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { UpdateDisputeDto } from './dto/update-dispute.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { Resend } from 'resend';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class DisputesService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async create(userId: string, createDisputeDto: CreateDisputeDto) {
    console.log(
      `Creating dispute for Order ID: ${createDisputeDto.orderId} by User: ${userId}`,
    );

    const order = await this.prisma.order.findUnique({
      where: { id: createDisputeDto.orderId },
    });

    if (!order) {
      console.error(`Order ${createDisputeDto.orderId} not found in DB`);
      throw new NotFoundException(
        `Order not found. ID: ${createDisputeDto.orderId}`,
      );
    }

    if (order.userId !== userId) {
      throw new NotFoundException('Order not found for this user');
    }

    /*
    // Check if dispute already exists for this order
    const existing = await this.prisma.dispute.findFirst({
      where: { orderId: createDisputeDto.orderId },
    });
    if (existing) {
      throw new BadRequestException('A dispute already exists for this order.');
    }
    */

    const dispute = await this.prisma.dispute.create({
      data: {
        userId,
        ...createDisputeDto,
      },
    });

    // Notify Admins
    // For now, we assume admins check the dashboard.

    return dispute;
  }

  async findAllForUser(userId: string) {
    return this.prisma.dispute.findMany({
      where: { userId },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllAdmin(query: any) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.page_size) || 10;
    const skip = (page - 1) * pageSize;

    const [results, count] = await Promise.all([
      this.prisma.dispute.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          order: { select: { id: true, total: true, status: true } },
        },
      }),
      this.prisma.dispute.count(),
    ]);

    return {
      results,
      count,
      page,
      page_size: pageSize,
    };
  }

  async findOne(id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: { include: { items: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    return dispute;
  }

  async addMessage(
    disputeId: string,
    senderId: string,
    data: { message: string; attachment?: string },
    isAdmin: boolean,
  ) {
    const dispute = await this.findOne(disputeId);

    const msg = await this.prisma.disputeMessage.create({
      data: {
        disputeId,
        senderId,
        message: data.message,
        attachment: data.attachment,
      },
    });

    // Notify the other party
    if (isAdmin) {
      // Admin replied, notify user
      await this.notificationsService.createNotification({
        userId: dispute.userId,
        title: 'New Message on Dispute',
        message: `Admin replied to your dispute #${dispute.ticketNumber}`,
        type: 'DISPUTE_MESSAGE',
      });
    } else {
      // User replied, notify admin (if applicable)
    }

    return msg;
  }

  async updateStatus(id: string, status: string) {
    const dispute = await this.findOne(id);

    const updated = await this.prisma.dispute.update({
      where: { id },
      data: { status },
      include: { user: true },
    });

    // Notification
    await this.notificationsService.createNotification({
      userId: dispute.userId,
      title: 'Dispute Status Updated',
      message: `Your dispute #${dispute.ticketNumber} status has been updated to ${status}`,
      type: 'DISPUTE_STATUS',
    });

    // Email
    if (dispute.user.email) {
      await this.sendDisputeStatusEmail(
        dispute.user.email,
        dispute.ticketNumber,
        status,
      );
    }

    return updated;
  }

  private async sendDisputeStatusEmail(
    email: string,
    ticketNumber: string,
    status: string,
  ) {
    try {
      await this.resend.emails.send({
        from: 'Gadget Cartel <support@resend.dev>', // Update with verify domain in prod
        to: email,
        subject: `Dispute #${ticketNumber} Update`,
        html: `
          <h2>Dispute Status Update</h2>
          <p>Your dispute (Ticket #${ticketNumber}) has been updated to: <strong>${status}</strong></p>
          <p>Please log in to your dashboard to view details.</p>
        `,
      });
    } catch (e) {
      console.error('Failed to send dispute email', e);
    }
  }

  async uploadAttachment(file: Express.Multer.File) {
    const result = await this.cloudinaryService.uploadImage(
      file,
      'disputes', // folder name
    );
    return { url: result.secure_url };
  }
}
