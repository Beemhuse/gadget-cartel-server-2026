import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('user/stats')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get user referral stats' })
  getStats(@Req() req) {
    return this.referralsService.getStats(req.user.id);
  }

  @Post('user/validate-code')
  @ApiOperation({ summary: 'Validate referral code' })
  validateCode(@Body() body: { code: string }) {
    return this.referralsService.validateCode(body.code);
  }
}
