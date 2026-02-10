import { Module } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AdsController } from './ads.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdsController],
  providers: [AdsService, CloudinaryService],
})
export class AdsModule {}
