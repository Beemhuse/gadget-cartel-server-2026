import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  IsArray,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateBannerOneDto {
  @ApiProperty({ example: 'HP Elite Book 840G5 512 SSD, 11th Gen' })
  @IsString()
  title: string;

  @ApiProperty({ required: false, example: 'Best Selling Now' })
  @IsOptional()
  @IsString()
  badgeText?: string;

  @ApiProperty({
    required: false,
    example: [
      '4K or OLED display for ultra-sharp visuals and deep colors.',
      'Latest-gen processors for high-speed multitasking.',
      'Long battery life and fast charging.',
    ],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return trimmed
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiProperty({ required: false, example: 400000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @ApiProperty({ required: false, example: 'Add to Cart' })
  @IsOptional()
  @IsString()
  buttonLabel?: string;

  @ApiProperty({ required: false, example: '/shop/slug' })
  @IsOptional()
  @IsString()
  buttonLink?: string;

  @ApiProperty({ required: false, example: 'https://...' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ default: false, required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ default: 0, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}

export class UpdateBannerOneDto extends PartialType(CreateBannerOneDto) {}
