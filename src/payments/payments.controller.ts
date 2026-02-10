import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('transactions')
  @ApiOperation({ summary: 'Get user payments' })
  findAll(@Req() req) {
    return this.paymentsService.findAll(req.user.sub);
  }

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate payment' })
  initiate(@Req() req, @Body() body: any) {
    return this.paymentsService.initiate(req.user.sub, body);
  }

  @Get('verify-payment')
  @ApiOperation({ summary: 'Verify payment from redirect' })
  verify(@Query('reference') reference: string) {
    return this.paymentsService.verify(reference);
  }

  @Post('verify-payment')
  @ApiOperation({ summary: 'Verify payment (POST)' })
  verifyPost(@Body() body: { reference?: string; payment_reference?: string }) {
    const ref = body.reference || body.payment_reference;
    if (!ref) throw new Error('Reference is required');
    return this.paymentsService.verify(ref);
  }

  // --- Admin Routes ---

  @Get('admin/transactions')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get all transactions (Admin)' })
  findAllAdmin(@Query() query: any) {
    return this.paymentsService.findAllAdmin(query);
  }
}
