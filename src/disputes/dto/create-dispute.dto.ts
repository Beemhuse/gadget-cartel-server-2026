import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDisputeDto {
  @ApiProperty({ description: 'ID of the order being disputed' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Reason for the dispute' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ description: 'Detailed description of the issue' })
  @IsString()
  @IsNotEmpty()
  description: string;
}
