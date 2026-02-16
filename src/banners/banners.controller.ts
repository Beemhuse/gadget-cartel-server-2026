import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { BannersService } from './banners.service';
import { CreateBannerOneDto, UpdateBannerOneDto } from './dto/banner-one.dto';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';

@ApiTags('Banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Get('banner-one')
  @ApiOperation({ summary: 'Get public Banner One' })
  findBannerOnePublic() {
    return this.bannersService.findBannerOnePublic();
  }

  // --- Admin Routes ---
  @Get('admin/banner-one')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'List Banner One entries (admin)' })
  findAllBannerOneAdmin(@Query() query: any) {
    return this.bannersService.findAllBannerOneAdmin(query);
  }

  @Post('admin/banner-one')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create Banner One (admin)' })
  createBannerOne(
    @Body() body: CreateBannerOneDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.bannersService.createBannerOne(body as any, file);
  }

  @Get('admin/banner-one/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Get Banner One details (admin)' })
  findBannerOneAdmin(@Param('id') id: string) {
    return this.bannersService.findBannerOneAdmin(id);
  }

  @Patch('admin/banner-one/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update Banner One (admin)' })
  updateBannerOne(
    @Param('id') id: string,
    @Body() body: UpdateBannerOneDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.bannersService.updateBannerOne(id, body as any, file);
  }

  @Delete('admin/banner-one/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Delete Banner One (admin)' })
  removeBannerOne(@Param('id') id: string) {
    return this.bannersService.removeBannerOne(id);
  }
}
