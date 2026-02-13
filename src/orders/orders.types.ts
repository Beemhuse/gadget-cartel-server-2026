import { Prisma } from '@prisma/client';

export type OrderWithItems = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        product: { include: { images: true } };
      };
    };
    address: true;
    payment: true;
  };
}>;

export type OrderWithUser = Prisma.OrderGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        email: true;
        phone: true;
        googlePic: true;
      };
    };
    items: {
      include: {
        product: { include: { images: true } };
      };
    };
    address: true;
    payment: true;
  };
}>;

export type OrderSummary = {
  subtotal: number;
  taxAmount: number;
  deliveryFee: number;
  discountAmount: number;
  couponAmount: number;
  total: number;
  itemCount: number;
  quantityCount: number;
};
