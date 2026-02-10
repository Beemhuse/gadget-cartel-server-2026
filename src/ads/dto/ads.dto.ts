import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsInt,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateAdDto {
  @ApiProperty({ example: 'Summer Campaign' })
  @IsString()
  adName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adMedia?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customText?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customTextColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customTextPosition?: string;

  @ApiProperty({ default: false, required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  showButton?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  buttonLabel?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  buttonColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  buttonTextColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  buttonAlignment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  buttonLink?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  displayLocation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  displayPosition?: string;

  @ApiProperty({ example: '2024-06-01T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: '2024-08-31T23:59:59Z', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

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

export class UpdateAdDto extends PartialType(CreateAdDto) {}
