import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
// import { AuthGuard } from '@nestjs/passport'; // For admin

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get store settings' })
  findAll() {
    return this.settingsService.findAll();
  }

  @Put()
  @ApiOperation({ summary: 'Update settings' })
  update(@Body() body: any) {
    // Check for admin
    // Loop through keys and update
    // Simplified for now
    return 'Not implemented fully';
  }
}
