import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { SaveOrganizerDraftDto } from './dto/save-organizer-draft.dto.js';
import { OrganizerApplicantGuard } from './organizer-applicant.guard.js';
import { OrganizerApplicationsService } from './organizer-applications.service.js';

@Controller('organizer-applications')
export class OrganizerApplicationsController {
	constructor(private readonly service: OrganizerApplicationsService) {}

	@Post('draft')
	@HttpCode(HttpStatus.OK)
	@UseGuards(JwtAuthGuard, OrganizerApplicantGuard)
	saveDraft(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: SaveOrganizerDraftDto,) {
		return this.service.saveDraft(user.id, dto);
	}

	@Get('draft')
	@UseGuards(JwtAuthGuard, OrganizerApplicantGuard)
	getDraft(@CurrentUser() user: AuthenticatedUser) {
		return this.service.getDraft(user.id);
	}
	@Post('submit')
	@UseGuards(JwtAuthGuard, OrganizerApplicantGuard)
	submit(@CurrentUser() user: AuthenticatedUser)
	{
		return this.service.submit(user.id);
	}
}
