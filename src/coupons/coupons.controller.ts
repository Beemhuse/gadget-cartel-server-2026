import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Param,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupons.dto';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate coupon code' })
  validate(@Body() body: { code: string }) {
    return this.couponsService.validate(body.code);
  }

  @Get('usages')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get coupon usages' })
  getUsages(@Req() req) {
    return this.couponsService.getUsages(req.user.id);
  }

  // --- Admin Routes ---

  @Get('admin/list')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'List all coupons (Admin)' })
  findAll(@Query() query: any) {
    return this.couponsService.findAll(query);
  }

  @Post('admin/create')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Create coupon (Admin)' })
  create(@Body() body: CreateCouponDto) {
    return this.couponsService.create(body);
  }

  @Get('admin/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Get coupon details (Admin)' })
  findOne(@Param('id') id: string) {
    return this.couponsService.findOne(id);
  }

  @Patch('admin/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Update coupon (Admin)' })
  update(@Param('id') id: string, @Body() body: UpdateCouponDto) {
    return this.couponsService.update(id, body);
  }

  @Delete('admin/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Delete coupon (Admin)' })
  remove(@Param('id') id: string) {
    return this.couponsService.delete(id);
  }
}
