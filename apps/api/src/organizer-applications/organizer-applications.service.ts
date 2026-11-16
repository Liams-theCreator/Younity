import { Injectable, ForbiddenException, NotFoundException, BadRequestException, NotImplementedException} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SaveOrganizerDraftDto } from './dto/save-organizer-draft.dto.js';
import type { OrganizerApplicationDraft } from '../generated/prisma/client.js';

@Injectable()
export class OrganizerApplicationsService {
	constructor(private readonly prisma: PrismaService) {}
	saveDraft(ownerId: string, dto: SaveOrganizerDraftDto) {
		const fields: Pick<
		SaveOrganizerDraftDto,
			| 'organizationName'
				| 'phoneNumber'
					| 'representativeFullName'
						| 'academicPosition'
							| 'proofUrl'
								| 'type'
								> = {};
		if (dto.organizationName !== undefined) {
			fields.organizationName = dto.organizationName;
		}
		if (dto.phoneNumber !== undefined) {
			fields.phoneNumber = dto.phoneNumber;
		}
		if (dto.representativeFullName !== undefined) {
			fields.representativeFullName = dto.representativeFullName;
		}
		if (dto.academicPosition !== undefined) {
			fields.academicPosition = dto.academicPosition;
		}
		if (dto.proofUrl !== undefined) {
			fields.proofUrl = dto.proofUrl;
		}
		if (dto.type !== undefined) {
			fields.type = dto.type;
		}
		return this.prisma.organizerApplicationDraft.upsert({
			where: { ownerId },
			create: { ownerId, ...fields },
			update: fields,
		});
	}
	async getDraft(ownerId: string) {
		const draft = await this.prisma.organizerApplicationDraft.findUnique({
			where: { ownerId },
		});

		if (!draft) {
			throw new NotFoundException('No organizer draft has been saved yet');
		}

		return draft;
	}
	private getMissingSubmissionFields(draft: OrganizerApplicationDraft): string[] {
		const missing: string[] = [];

		if (!draft.organizationName?.trim()) {
			missing.push('organizationName');
		}
		if (!draft.phoneNumber?.trim()) {
			missing.push('phoneNumber');
		}
		if (!draft.representativeFullName?.trim()) {
			missing.push('representativeFullName');
		}
		if (!draft.academicPosition?.trim()) {
			missing.push('academicPosition');
		}
		if (draft.type === null) {
			missing.push('type');
		}
		return missing;
	}
	async submit(ownerId: string) {
		const draft = await this.getDraft(ownerId);
		const missingFields = this.getMissingSubmissionFields(draft);

		if (missingFields.length > 0) {
			throw new BadRequestException({
				message: 'Application is incomplete',
				missingFields,
			});
		}
		const owner = await this.prisma.user.findUnique({
			where: { id: ownerId },
			select: { emailVerifiedAt: true },
		});

		if (!owner) {
			throw new NotFoundException('Organizer account not found');
		}

		if (owner.emailVerifiedAt === null) {
			throw new ForbiddenException('Verify your email before submitting');
		}
		throw new NotImplementedException('Submission is not implemented yet');
	}
}
