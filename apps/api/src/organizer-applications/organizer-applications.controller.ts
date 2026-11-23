import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post, Patch, UseGuards, Get, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { createValidationPipe } from '../config/application.js';
import { SaveOrganizerDraftDto } from './dto/save-organizer-draft.dto.js';
import { OrganizerApplicantGuard } from './organizer-applicant.guard.js';
import { OrganizerApplicationsService } from './organizer-applications.service.js';
import { proofUploadLimits, readProofUpload, type ProofUpload } from './organizer-proof.js';

const validateDraft = createValidationPipe();

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
	@UseInterceptors(FileInterceptor('proof', { limits: proofUploadLimits }))
	async patchDraft(
		@CurrentUser() user: AuthenticatedUser,
		@Body() body: unknown,
		@UploadedFile() file?: ProofUpload,
	) {
		let input = body;
		if (file) {
			if (!body || typeof body !== 'object' || Array.isArray(body) ||
				Object.keys(body).some((key) => key !== 'changes')) {
				throw new BadRequestException('Invalid draft upload fields.');
			}
			const changes = 'changes' in body ? body.changes : '{}';
			if (typeof changes !== 'string') throw new BadRequestException('Invalid draft changes.');
			try {
				input = JSON.parse(changes) as unknown;
			} catch {
				throw new BadRequestException('Invalid draft changes.');
			}
			if (!input || typeof input !== 'object' || Array.isArray(input)) {
				throw new BadRequestException('Invalid draft changes.');
			}
		}
		const dto = await validateDraft.transform(input, {
			type: 'body',
			metatype: SaveOrganizerDraftDto,
		}) as SaveOrganizerDraftDto;
		const saved = await this.service.saveDraft(user.id, dto, file && readProofUpload(file));

		return {
			draft: {
				organizationName: saved.organizationName,
				type: saved.type,
				representativeFullName: saved.representativeFullName,
				academicPosition: saved.academicPosition,
				phoneNumber: saved.phoneNumber,
				proofUrl: saved.proofUrl,
				...(saved.proof && { proof: saved.proof }),
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
