import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  UseGuards,
  Req,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications' })
  findAll(@Req() req, @Query() query: any) {
    const userId = this.getUserId(req);
    return this.notificationsService.findAll(userId, query);
  }

  @Get('admin')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get admin notifications' })
  findAllAdmin(@Req() req, @Query() query: any) {
    const userId = this.getUserId(req);
    return this.notificationsService.findAll(userId, query);
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@Req() req) {
    const userId = this.getUserId(req);
    return this.notificationsService.markAllRead(userId);
  }

  @Post('admin/mark-all-read')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Mark all admin notifications as read' })
  markAllReadAdmin(@Req() req) {
    const userId = this.getUserId(req);
    return this.notificationsService.markAllRead(userId);
  }

  @Patch(':id/mark-as-read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('admin/:id/mark-as-read')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Mark admin notification as read' })
  markAsReadAdmin(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }

  @Delete('admin/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Delete admin notification' })
  removeAdmin(@Param('id') id: string) {
    return this.notificationsService.remove(id);
  }

  private getUserId(req: any) {
    const userId = req?.user?.userId ?? req?.user?.sub ?? req?.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid auth payload');
    }
    return userId;
  }
}
