import { Controller, Get, Post, Body } from '@nestjs/common';
import { SupportService } from './support.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('contact')
  @ApiOperation({ summary: 'Submit contact request' })
  createContact(@Body() body: any) {
    return this.supportService.createContact(body);
  }

  @Get('faq')
  @ApiOperation({ summary: 'Get FAQs' })
  getFaqs() {
    return this.supportService.getFaqs();
  }
}
