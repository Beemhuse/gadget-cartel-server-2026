import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  Patch,
  Delete,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { AdsService } from './ads.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';
import { CreateAdDto, UpdateAdDto } from './dto/ads.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';

@ApiTags('Ads')
@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get('ads-public')
  @ApiOperation({ summary: 'Get public ads' })
  findAllPublic() {
    return this.adsService.findAllPublic();
  }

  // --- Admin Routes ---

  // New endpoint: Delete ad image only
  @Delete('admin/:id/image')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({
    summary: 'Delete ad image only (admin)',
    description:
      'Deletes only the image from the ad while keeping other ad data',
  })
  @ApiResponse({
    status: 200,
    description: 'Image deleted successfully',
    schema: {
      example: {
        success: true,
        message: 'Image deleted successfully',
        data: {
          id: 'ad-id',
          adName: 'Ad Name',
          adMedia: null,
          // ... other ad fields
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Ad not found or no image to delete',
  })
  async deleteImage(@Param('id') id: string) {
    return this.adsService.deleteImage(id);
  }

  @Get('admin-list')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Get all ads (admin)' })
  findAllAdmin(@Query() query: any) {
    return this.adsService.findAllAdmin(query);
  }

  @Post('create')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @UseInterceptors(FileInterceptor('adMedia'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create ad (admin)' })
  create(
    @Body() body: CreateAdDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adsService.create(body, file);
  }

  @Get('admin/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Get ad details (admin)' })
  findOne(@Param('id') id: string) {
    return this.adsService.findOne(id);
  }

  @Patch('admin/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @UseInterceptors(FileInterceptor('adMedia'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update ad (admin)' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateAdDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adsService.update(id, body, file);
  }

  @Delete('admin/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Delete ad (admin)' })
  remove(@Param('id') id: string) {
    return this.adsService.remove(id);
  }

  @Post('admin/:id/reschedule')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Reschedule ad (admin)' })
  reschedule(
    @Param('id') id: string,
    @Body() body: { startDate: string; endDate: string },
  ) {
    return this.adsService.reschedule(id, body);
  }

  @Post('admin/:id/duplicate')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Duplicate ad (admin)' })
  duplicate(@Param('id') id: string) {
    return this.adsService.duplicate(id);
  }
}
