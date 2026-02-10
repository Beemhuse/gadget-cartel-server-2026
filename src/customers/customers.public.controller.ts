import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Customers')
@Controller('customers')
export class CustomersPublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('store-locations')
  @ApiOperation({ summary: 'Get store locations' })
  async getStoreLocations() {
    return this.prisma.storeLocation.findMany({
      where: { isActive: true },
    });
  }

  @Get('delivery-methods')
  @ApiOperation({ summary: 'Get delivery methods' })
  async getDeliveryMethods() {
    return this.prisma.deliveryMethod.findMany({
      where: { isActive: true },
    });
  }

  @Get('shipping-zones')
  @ApiOperation({ summary: 'Get shipping zones' })
  async getShippingZones() {
    return this.prisma.shippingZone.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('shipping-prices')
  @ApiOperation({ summary: 'Get shipping prices' })
  async getShippingPrices(@Query() query: any) {
    const deliveryMethodId =
      query?.delivery_method_id || query?.deliveryMethodId;
    const deliveryType = query?.type || query?.delivery_type;

    return this.prisma.shippingPrice.findMany({
      where: {
        isActive: true,
        ...(deliveryMethodId ? { deliveryMethodId } : {}),
        zone: { isActive: true },
        deliveryMethod: {
          isActive: true,
          ...(deliveryType ? { type: deliveryType } : {}),
        },
      },
      include: {
        zone: true,
        deliveryMethod: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
