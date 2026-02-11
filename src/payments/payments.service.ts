import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      select: {
        id: true,
        orderId: true,
        userId: true,
        amount: true,
        method: true,
        reference: true,
        transactionId: true,
        channel: true,
        status: true,
        createdAt: true,
        order: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllAdmin(query: any) {
    const { page = 1, page_size = 10 } = query;
    const skip = (Number(page) - 1) * Number(page_size);
    const take = Number(page_size);

    const [results, count] = await Promise.all([
      this.prisma.payment.findMany({
        select: {
          id: true,
          orderId: true,
          userId: true,
          amount: true,
          method: true,
          reference: true,
          transactionId: true,
          channel: true,
          status: true,
          createdAt: true,
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  phone: true,
                  is_admin: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.payment.count(),
    ]);

    return {
      results,
      count,
      page: Number(page),
      page_size: Number(page_size),
    };
  }

  async initiate(userId: string, data: any) {
    const orderId = data.orderId || data.order_id;

    // 1. Get user and order
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new Error('Order not found');

    const amount = Number(order.total);
    const reference = `ref_${Date.now()}_${order.id.slice(0, 8)}`;

    // 2. Call Paystack Initialize
    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          amount: amount * 100, // Paystack expects kobo/cents
          reference,
          callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
          metadata: {
            orderId: order.id,
            userId: user.id,
          },
        }),
      },
    );

    const resData: any = await response.json();

    if (!resData.status) {
      throw new Error(resData.message || 'Failed to initialize payment');
    }

    // 3. Create/Update payment record
    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        amount,
        reference,
        status: 'PENDING',
      },
      create: {
        orderId: order.id,
        userId: user.id,
        amount,
        reference,
        status: 'PENDING',
      },
    });

    return resData.data; // { authorization_url, access_code, reference }
  }

  async verify(reference: string) {
    // 1. Call Paystack Verify
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    const resData: any = await response.json();

    if (!resData.status) {
      throw new Error(resData.message || 'Verification failed');
    }

    const paystackData = resData.data;
    const {
      status,
      reference: ref,
      amount,
      channel,
      gateway_response,
    } = paystackData;
    const orderId = paystackData.metadata.orderId;

    // 2. Update Payment
    const paymentStatus = status === 'success' ? 'SUCCESS' : 'FAILED';
    const payment = await this.prisma.payment.update({
      where: { reference: ref },
      data: {
        status: paymentStatus,
        transactionId: paystackData.id.toString(),
        channel,
        metadata: paystackData,
      },
    });

    // 3. Update Order if success
    if (paymentStatus === 'SUCCESS') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'PROCESSING',
        },
      });
    }

    return {
      status: paymentStatus,
      orderId,
      gatewayResponse: gateway_response,
      data: {
        id: payment.id,
        amount: Number(payment.amount),
        reference: payment.reference,
        status: payment.status,
        channel: payment.channel,
        orderNumber: orderId.slice(0, 8).toUpperCase(), // Or use a separate order_number field if it exists
      },
    };
  }
}
