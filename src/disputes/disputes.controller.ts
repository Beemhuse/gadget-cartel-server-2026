import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@ApiTags('Disputes')
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Create a new dispute' })
  create(@Req() req, @Body() createDisputeDto: CreateDisputeDto) {
    return this.disputesService.create(req.user.userId, createDisputeDto);
  }

  @Get('my-disputes')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get user disputes' })
  findAllForUser(@Req() req) {
    return this.disputesService.findAllForUser(req.user.userId);
  }

  @Get('admin/all')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Get all disputes (Admin)' })
  findAllAdmin(@Query() query: any) {
    return this.disputesService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt')) // Add check if user owns it or is admin
  @ApiOperation({ summary: 'Get dispute details' })
  findOne(@Param('id') id: string) {
    return this.disputesService.findOne(id);
  }

  @Post(':id/messages')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Add message to dispute' })
  addMessage(
    @Param('id') id: string,
    @Req() req,
    @Body() body: { message: string; attachment?: string },
  ) {
    const isAdmin = req.user.is_admin || false;
    return this.disputesService.addMessage(id, req.user.userId, body, isAdmin); // Fixed: req.user.userId
  }

  @Post('upload')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload dispute attachment' })
  uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    return this.disputesService.uploadAttachment(file);
  }

  @Patch('admin/:id/status')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Update dispute status (Admin)' })
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.disputesService.updateStatus(id, body.status);
  }
}
