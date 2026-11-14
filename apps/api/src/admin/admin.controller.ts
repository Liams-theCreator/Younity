import {
  Controller,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Body,
} from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { AdminDecisionDto } from './dto/admin-decision-dto.js';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  @Post('applications/:id/approve')
  async approveApplication(
    @Param('id') applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminDecisionDto,
  ) {
    return this.adminService.approveApplication(
      applicationId,
      user.id,
      dto.reason,
    );
  }
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  @Post('applications/:id/reject')
  async rejectApplication(
    @Param('id') applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminDecisionDto,
  ) {
    return this.adminService.rejectApplication(
      applicationId,
      user.id,
      dto.reason,
    );
  }
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  @Post('applications/:id/request-changes')
  async requestChangesApplication(
    @Param('id') applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdminDecisionDto,
  ) {
    return this.adminService.requestChangesApplication(
      applicationId,
      user.id,
      dto.reason,
    );
  }
}
