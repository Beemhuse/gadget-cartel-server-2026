import {
  IsString,
  IsOptional,
  IsNumber,
  IsHexColor,
  IsUUID,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';

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
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  capacity: string;

  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  price: number;
}

export class UpdateStorageOptionDto extends PartialType(
  CreateStorageOptionDto,
) {}
