import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('product/:id')
  @ApiOperation({ summary: 'Get product reviews' })
  findForProduct(@Param('id') id: string) {
    return this.reviewsService.findForProduct(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product review' })
  create(@Req() req, @Body() body: CreateReviewDto) {
    return this.reviewsService.create(req.user.sub, body);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user reviews' })
  findMine(@Req() req) {
    return this.reviewsService.findForUser(req.user.sub);
  }

  @Get('admin')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all reviews (Admin)' })
  findAdmin(@Query() query: any) {
    return this.reviewsService.findAllAdmin(query);
  }
}
