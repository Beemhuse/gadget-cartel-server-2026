import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export enum CouponType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export class CreateCouponDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: '20% off on all items', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsNumber()
  discountValue: number;

  @ApiProperty({ enum: CouponType, example: CouponType.PERCENTAGE })
  @IsEnum(CouponType)
  discountType: CouponType;

  @ApiProperty({ example: 100, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maximumDiscount?: number;

  @ApiProperty({ example: '2024-12-31', required: false })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiProperty({ example: '2024-12-31', required: false })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({ example: 100, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  usageLimit?: number;

  @ApiProperty({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  usageLimitPerUser?: number;

  @ApiProperty({ example: 100, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minimumOrderAmount?: number;

  @ApiProperty({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  applicableToAll?: boolean;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  applicableProducts?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  applicableCategories?: string[];

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  assignedUsers?: string[];

  @ApiProperty({ default: true, required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}
