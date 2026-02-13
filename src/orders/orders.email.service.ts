import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class OrdersEmailService {
  private resend = new Resend(process.env.RESEND_API_KEY);

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  }

  private buildHtml(order: any, status: 'in_transit' | 'delivered') {
    const rows = order.items
      .map((item: any) => {
        const total = item.price * item.quantity;
        return `
          <tr>
            <td>${item.product?.name}</td>
            <td>${item.quantity}</td>
            <td>${this.formatCurrency(item.price)}</td>
            <td>${this.formatCurrency(total)}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <h2>Your order is ${status}</h2>
      <p>Order #${order.id.slice(0, 8).toUpperCase()}</p>
      <table>${rows}</table>
    `;
  }

  async sendReceipt(
    order: { id: string; items: any[]; user?: { email?: string } },
    status: 'in_transit' | 'delivered',
  ) {
    if (!order.user?.email) return;

    await this.resend.emails.send({
      from: 'Gadget Cartel <onboarding@resend.dev>',
      to: order.user.email,
      subject: `Order #${order.id.slice(0, 8)} ${status}`,
      html: this.buildHtml(order, status),
    });
  }
}
