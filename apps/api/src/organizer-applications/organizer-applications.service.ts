import {
	Injectable,
	NotFoundException,
	BadRequestException,
	ForbiddenException,
	ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SaveOrganizerDraftDto } from './dto/save-organizer-draft.dto.js';
import type { OrganizerApplicationDraft } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { advanceApplicationRevision } from '../admin/application-revision.js';
import { proofMetadata, type ProofData } from './organizer-proof.js';

@Injectable()
export class OrganizerApplicationsService {
	constructor(private readonly prisma: PrismaService) {}

	async saveDraft(ownerId: string, dto: SaveOrganizerDraftDto, proof?: ProofData) {
		const fields: Pick<
			SaveOrganizerDraftDto,
			| 'organizationName'
			| 'type'
			| 'representativeFullName'
			| 'academicPosition'
			| 'phoneNumber'
			| 'proofUrl'
		> = {};

		if (dto.organizationName !== undefined)
			fields.organizationName = dto.organizationName;
		if (dto.type !== undefined)
			fields.type = dto.type;
		if (dto.representativeFullName !== undefined)
			fields.representativeFullName = dto.representativeFullName;
		if (dto.academicPosition !== undefined)
			fields.academicPosition = dto.academicPosition;
		if (dto.phoneNumber !== undefined)
			fields.phoneNumber = dto.phoneNumber;
		if (dto.proofUrl !== undefined)
			fields.proofUrl = dto.proofUrl;

		try {
			return await this.prisma.$transaction(
				async (tx) => {
					const blockingApplication =
						await tx.organizationApplication.findFirst({
							where: {
								organization: { ownerId },
								status: { in: ['PENDING', 'APPROVED', 'REJECTED'] },
							},
							select: { status: true },
						});

					if (blockingApplication) {
						throw new ConflictException(
							`Cannot edit a draft while the application is ${blockingApplication.status}`,
						);
					}

					const changesRequested =
						await tx.organizationApplication.findFirst({
							where: {
								submittedById: ownerId,
								organization: { ownerId },
								status: 'NEEDS_CHANGES',
							},
							select: {
								organization: {
									select: {
										orgName: true,
										type: true,
										representativeFullName: true,
										academicPosition: true,
										phoneNumber: true,
										proofUrl: true,
										proof: { select: proofMetadata },
									},
								},
							},
						});

					const submitted = changesRequested?.organization;
					const saved = await tx.organizerApplicationDraft.upsert({
						where: { ownerId },
						create: {
							ownerId,
							...(submitted && {
								organizationName: submitted.orgName,
								type: submitted.type,
								representativeFullName: submitted.representativeFullName,
								academicPosition: submitted.academicPosition,
								phoneNumber: submitted.phoneNumber,
								proofUrl: submitted.proofUrl,
							}),
							...fields,
							...(proof && { proof: { create: proof } }),
						},
						update: {
							...fields,
							...(proof && { proof: { upsert: { create: proof, update: proof } } }),
						},
						include: { proof: { select: proofMetadata } },
					});
					const { proof: savedProof, ...savedFields } = saved;
					const effectiveProof = savedProof ?? submitted?.proof;
					return { ...savedFields, ...(effectiveProof && { proof: effectiveProof }) };
				},
				{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
			);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2034'
			) {
				throw new ConflictException(
					'Application changed; reload the draft and retry',
				);
			}
			throw error;
		}
	}

	async getDraft(ownerId: string) {
		const [savedDraft, application] = await this.prisma.$transaction(
			[
				this.prisma.organizerApplicationDraft.findUnique({
					where: { ownerId },
					select: {
						organizationName: true,
						type: true,
						representativeFullName: true,
						academicPosition: true,
						phoneNumber: true,
						proofUrl: true,
						proof: { select: proofMetadata },
					},
				}),
				this.prisma.organizationApplication.findFirst({
					where: { organization: { ownerId } },
					select: {
						status: true,
						organization: {
							select: {
								orgName: true,
								type: true,
								representativeFullName: true,
								academicPosition: true,
								phoneNumber: true,
								proofUrl: true,
								proof: { select: proofMetadata },
							},
						},
					},
				}),
			],
			{ isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
		);

		const submitted = application ? {
			organizationName: application.organization.orgName,
			type: application.organization.type,
			representativeFullName: application.organization.representativeFullName,
			academicPosition: application.organization.academicPosition,
			phoneNumber: application.organization.phoneNumber,
			proofUrl: application.organization.proofUrl,
			proof: application.organization.proof,
		} : null;

		const canEdit = !application || application.status === 'NEEDS_CHANGES';
		const snapshot = canEdit ? savedDraft ?? submitted : submitted;
		if (!snapshot) return { draft: null, canEdit };
		const { proof, ...fields } = snapshot;
		const effectiveProof = proof ?? submitted?.proof;
		return { draft: { ...fields, ...(effectiveProof && { proof: effectiveProof }) }, canEdit };
	}

	private getMissingSubmissionFields(
		draft: OrganizerApplicationDraft,
	): string[] {
		const missing: string[] = [];

		if (!draft.organizationName?.trim())
			missing.push('organizationName');
		if (!draft.phoneNumber?.trim())
			missing.push('phoneNumber');
		if (!draft.representativeFullName?.trim())
			missing.push('representativeFullName');
		if (!draft.academicPosition?.trim())
			missing.push('academicPosition');
		if (draft.type === null)
			missing.push('type');

		return missing;
	}

	async submit(ownerId: string) {
		try {
			return await this.prisma.$transaction(
				async (tx) => {
					const owner = await tx.user.findUnique({
						where: { id: ownerId },
						select: {
							role: true,
							status: true,
							emailVerifiedAt: true,
						},
					});

					if (
						!owner ||
						owner.role !== 'ORGANIZER' ||
						owner.status === 'SUSPENDED'
					) {
						throw new ForbiddenException(
							'Account cannot submit an application',
						);
					}

					if (owner.emailVerifiedAt === null) {
						throw new ForbiddenException(
							'Verify your email before submitting',
						);
					}

					const organizations = await tx.organization.findMany({
						where: { ownerId },
						select: { id: true },
						take: 2,
					});

					const organization = organizations[0];

					if (!organization || organizations.length !== 1) {
						throw new ConflictException(
							'Expected exactly one owned organization',
						);
					}

					const existing = await tx.organizationApplication.findFirst({
						where: { organizationId: organization.id },
						select: { id: true, status: true, revision: true },
					});

					if (existing && existing.status !== 'NEEDS_CHANGES') {
						throw new ConflictException(
							`Cannot submit while the application is ${existing.status}`,
						);
					}

					const draft = await tx.organizerApplicationDraft.findUnique({
						where: { ownerId },
						include: { proof: { select: { id: true } } },
					});

					if (!draft) {
						throw new NotFoundException(
							'No organizer draft has been saved yet',
						);
					}

					const missingFields = this.getMissingSubmissionFields(draft);

					if (missingFields.length > 0) {
						throw new BadRequestException({
							message: 'Application is incomplete',
							missingFields,
						});
					}

					if (existing) {
						await advanceApplicationRevision(
							tx,
							existing.id,
							existing.revision,
						);
					}

					await tx.organization.update({
						where: { id: organization.id, ownerId },
						data: {
							orgName: draft.organizationName!,
							verificationStatus: 'PENDING',
							type: draft.type!,
							representativeFullName: draft.representativeFullName!,
							academicPosition: draft.academicPosition!,
							phoneNumber: draft.phoneNumber!,
							proofUrl: draft.proof ? null : draft.proofUrl,
						},
					});

					if (draft.proof) {
						await tx.organizerProof.deleteMany({ where: { organizationId: organization.id } });
						await tx.organizerProof.update({
							where: { id: draft.proof.id },
							data: { organizationId: organization.id, draftOwnerId: null },
						});
					}

					const select = {
						id: true,
						status: true,
						revision: true,
						submittedAt: true,
					} as const;

					const application = existing
						? await tx.organizationApplication.findUniqueOrThrow({
								where: { id: existing.id },
								select,
							})
						: await tx.organizationApplication.create({
								data: {
									organizationId: organization.id,
									submittedById: ownerId,
									status: 'PENDING',
								},
								select,
							});

					await tx.organizerApplicationDraft.delete({
						where: { ownerId },
					});

					return application;
				},
				{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
			);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2034'
			) {
				throw new ConflictException(
					'Application changed; reload before submitting again',
				);
			}
			throw error;
		}
	}
}
