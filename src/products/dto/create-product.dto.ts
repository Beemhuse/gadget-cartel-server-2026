import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  shortDescription?: string;

  @IsOptional()
  @IsString()
  fullDescription?: string;

  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  price: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  originalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  stockQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  lowStockThreshold?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  featureOnHomepage?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isTrending?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isBestSelling?: boolean;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsArray()
  tagIds?: string[];

  @IsOptional()
  @IsArray()
  colorIds?: string[];

  @IsOptional()
  @IsArray()
  storageOptionIds?: string[];

  @IsOptional()
  @IsArray()
  features?: string[];

  @IsOptional()
  @IsArray()
  specifications?: any[];

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  lengthCm?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  widthCm?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? parseFloat(value) : undefined))
  heightCm?: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value ? parseInt(value) : undefined))
  warrantyMonths?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isWarrantyCovered?: boolean;
}
