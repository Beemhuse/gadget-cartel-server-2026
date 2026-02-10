import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
      },
    });

    if (!cart) {
      // Verify user exists before creating cart to avoid FK violations (P2003)
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new UnauthorizedException('User not found or session expired');
      }

      cart = await this.prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: true,
                },
              },
            },
          },
        },
      });
    }

    return cart;
  }

  async addItem(
    userId: string,
    productId: string,
    quantity: number,
    metadata?: any,
  ) {
    const cart = await this.getCart(userId);

    // Verify product exists to prevent 500 FK error
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new BadRequestException('Product not found');
    }

    // Fetch all items for this product in the cart
    const existingItems = await this.prisma.cartItem.findMany({
      where: {
        cartId: cart.id,
        productId,
      },
    });

    // Sanitize metadata (remove undefined values to avoid Prisma issues or stringify mismatches)
    const cleanMetadata = JSON.parse(JSON.stringify(metadata || {}));

    // Find the item with matching metadata
    const existingItem = existingItems.find((item) => {
      const itemMeta = item.metadata ? item.metadata : {};
      return JSON.stringify(itemMeta) === JSON.stringify(cleanMetadata);
    });

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          metadata: cleanMetadata,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(
    userId: string,
    cartItemId: string,
    data: { quantity?: number; metadata?: any },
  ) {
    const cart = await this.getCart(userId);
    console.log(cartItemId, 'cartItemId');
    let item = await this.prisma.cartItem.findFirst({
      where: { id: cartItemId, cartId: cart.id },
    });

    // Fallback: search by productId if uniqueId looks like a productId
    if (!item) {
      item = await this.prisma.cartItem.findFirst({
        where: { productId: cartItemId, cartId: cart.id },
      });
    }

    if (!item) {
      throw new BadRequestException('Item not found in cart');
    }

    const updateData: any = {};
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: updateData,
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getCart(userId);

    // Check if it's a cart item ID or product ID
    let item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });

    if (!item) {
      item = await this.prisma.cartItem.findFirst({
        where: { productId: itemId, cartId: cart.id },
      });
    }

    if (item) {
      await this.prisma.cartItem.delete({
        where: { id: item.id },
      });
    }

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.getCart(userId);
    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });
    return this.getCart(userId);
  }
}
