import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOrderDto {
  @ApiProperty({ description: 'Order status', required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ description: 'Payment status', required: false })
  @IsString()
  @IsOptional()
  paymentStatus?: string;

  @ApiProperty({ description: 'Delivery status', required: false })
  @IsString()
  @IsOptional()
  deliveryStatus?: string;

  @ApiProperty({ description: 'Tracking code', required: false })
  @IsString()
  @IsOptional()
  trackingCode?: string;

  @ApiProperty({ description: 'Scheduled delivery date', required: false })
  @IsDateString()
  @IsOptional()
  deliveryDate?: Date;

  @ApiProperty({ description: 'Actual shipping date', required: false })
  @IsDateString()
  @IsOptional()
  shippingDate?: Date;

  @ApiProperty({ description: 'Actual delivery date', required: false })
  @IsDateString()
  @IsOptional()
  deliveredAt?: Date;

  // Including underscore versions for compatibility if needed, though camelCase is preferred
  @IsString()
  @IsOptional()
  payment_status?: string;

  @IsString()
  @IsOptional()
  delivery_status?: string;

  @IsString()
  @IsOptional()
  tracking_code?: string;

  @IsDateString()
  @IsOptional()
  delivery_date?: Date;

  @IsDateString()
  @IsOptional()
  shipping_date?: Date;

  @IsString()
  @IsOptional()
  delivery_type?: string;

  @IsString()
  @IsOptional()
  deliveryType?: string;

  @IsDateString()
  @IsOptional()
  delivered_at?: Date;
}
