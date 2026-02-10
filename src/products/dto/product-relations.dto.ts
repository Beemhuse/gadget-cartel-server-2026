import { IsString, IsOptional, IsNumber, IsHexColor } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

// Brands
export class CreateBrandDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}

// Tags
export class CreateTagDto {
  @IsString()
  name: string;
}

export class UpdateTagDto extends PartialType(CreateTagDto) {}

// Colors
export class CreateColorDto {
  @IsString()
  name: string;

  @IsHexColor()
  value: string;
}

export class UpdateColorDto extends PartialType(CreateColorDto) {}

// Storage Options
export class CreateStorageOptionDto {
  @IsString()
  capacity: string;

  @IsNumber()
  price: number;
}

export class UpdateStorageOptionDto extends PartialType(
  CreateStorageOptionDto,
) {}
