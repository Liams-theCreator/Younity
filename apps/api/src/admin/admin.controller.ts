import { Controller, Param, Post } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { UseGuards, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';


@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
	constructor(private readonly adminService: AdminService) {}
	@Post('applications/:id/approve')
	async approveApplication(@Param('id') applicationId: string,
					   @CurrentUser() user:AuthenticatedUser,
					   @Body('reason') reason: string) {
			const result = await this.adminService.approveApplication(applicationId, user.id, reason);
	}
}
