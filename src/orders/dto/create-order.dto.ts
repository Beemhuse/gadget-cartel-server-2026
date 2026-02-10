import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({
    description: 'The ID of the billing address',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  billing_address_id: string;

  @ApiProperty({
    description: 'The delivery type (e.g., home_delivery, pickup)',
    example: 'home_delivery',
  })
  @IsString()
  @IsNotEmpty()
  delivery_type: string;

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
