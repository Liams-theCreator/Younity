import { Body, Controller, HttpCode, HttpStatus, Post, Patch, UseGuards, Get } from '@nestjs/common';
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
	@Patch('draft')
	@UseGuards(JwtAuthGuard, OrganizerApplicantGuard)
	async patchDraft(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: SaveOrganizerDraftDto,
	) {
		const saved = await this.service.saveDraft(user.id, dto);

		return {
			draft: {
				organizationName: saved.organizationName,
				type: saved.type,
				representativeFullName: saved.representativeFullName,
				academicPosition: saved.academicPosition,
				phoneNumber: saved.phoneNumber,
				proofUrl: saved.proofUrl,
			},
			canEdit: true,
		};
	}

	@Get('draft')
	@UseGuards(JwtAuthGuard, OrganizerApplicantGuard)
	getDraft(@CurrentUser() user: AuthenticatedUser) {
		return this.service.getDraft(user.id);
	}
	@Post('submit')
	@UseGuards(JwtAuthGuard, OrganizerApplicantGuard)
	async submit(@CurrentUser() user: AuthenticatedUser) {
		const application = await this.service.submit(user.id);

		return {
			application: {
				id: application.id,
				status: application.status,
			},
		};
	}
}
