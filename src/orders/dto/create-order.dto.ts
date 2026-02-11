import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({
    description: 'The ID of the billing address (required for home delivery)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @ValidateIf(
    (o) =>
      String(o.delivery_type || '').toLowerCase() !== 'pick_up_from_store' &&
      String(o.delivery_type || '').toLowerCase() !== 'pickup',
  )
  @IsUUID()
  @IsNotEmpty()
  @IsOptional()
  billing_address_id?: string;

  @ApiProperty({
    description: 'The delivery type (e.g., home_delivery, pickup)',
    example: 'home_delivery',
  })
  @IsString()
  @IsNotEmpty()
  delivery_type: string;

  @ApiProperty({
    description: 'The store location ID for pickup orders',
    required: false,
    example: 'store-location-uuid',
  })
  @ValidateIf(
    (o) =>
      String(o.delivery_type || '').toLowerCase() === 'pick_up_from_store' ||
      String(o.delivery_type || '').toLowerCase() === 'pickup',
  )
  @IsUUID()
  @IsNotEmpty()
  @IsOptional()
  store_location_id?: string;

  @ApiProperty({
    description: 'Optional coupon code to apply',
    required: false,
    example: 'SUMMER2024',
  })
  @IsString()
  @IsOptional()
  coupon_code?: string;

  @ApiProperty({
    description: 'The ID of the shipping zone (required for delivery)',
    required: false,
    example: 'zone-uuid',
  })
  @IsString()
  @IsOptional()
  zone_id?: string;

  @ApiProperty({
    description: 'The ID of the delivery method',
    required: false,
    example: 'delivery-method-uuid',
  })
  @IsString()
  @IsOptional()
  delivery_method_id?: string;
}
