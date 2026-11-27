import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { UserRole } from '../generated/prisma/enums.js';
import { OrganizerDashboardService } from './organizer-dashboard.service.js';

@ApiTags('Organizer dashboard')
@ApiCookieAuth()
@Controller('organizer-dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER)
export class OrganizerDashboardController {
  constructor(private readonly dashboard: OrganizerDashboardService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read the current organizer’s metrics, upcoming events, drafts and recent bookings' })
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.overview(user.id);
  }
}
