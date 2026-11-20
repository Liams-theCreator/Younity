import { PrismaService } from '../prisma/prisma.service.js'
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import type { OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { UserStatus } from '../generated/prisma/enums.js';

@Injectable()
export class AuthService implements OnModuleInit
{
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService,
	) {}
	private dummyPasswordHash!: string;

	async onModuleInit(): Promise<void> {
		const randomPassword = randomBytes(32).toString('hex');
		this.dummyPasswordHash = await argon2.hash(randomPassword);
	}

	async findUserForLogin(email: string)
	{
		const normalizedEmail = email.trim().toLowerCase();
		return this.prisma.user.findUnique({
			where: {
				email: normalizedEmail,
			},
			select: {
				id: true,
				email: true,
				passwordHash: true,
				status: true,
				emailVerifiedAt: true,
			},
		});
	}

	async validateCredentials(email: string, password: string)
	{
		const user = await this.findUserForLogin(email);

		const hashToCheck = user?.passwordHash ?? this.dummyPasswordHash;
		const passwordMatches = await argon2.verify(hashToCheck, password);

		if (!passwordMatches || user == null)
			throw new UnauthorizedException('Invalid credentials');
		if (user.status === UserStatus.SUSPENDED)
			throw new ForbiddenException('Account suspended');
		if (!user.emailVerifiedAt)
			throw new ForbiddenException({
				code: 'EMAIL_NOT_VERIFIED',
				message: 'Verify your email before signing in.',
			});

		return {
			id: user.id,
			email: user.email,
		};
	}

	async getOrganizerOnboarding(organizationId: string) {
		const application = await this.prisma.organizationApplication.findFirst({
			where: { organizationId },
			select: { id: true, status: true, reviewerNote: true },
		});

		const complete = application !== null;
		const organization = await this.prisma.organization.findUniqueOrThrow({
			where: { id: organizationId },
			select: { approvalAcknowledgedAt: true },
		});

		return {
			complete,
			application,
			approvalAcknowledged: organization.approvalAcknowledgedAt !== null,
			nextStep: complete ? 'NONE' : 'COMPLETE_ORGANIZER_APPLICATION',
		};
	}

	async getStudentOnboarding(userId: string) {
		const profile = await this.prisma.studentProfile.findUnique({
			where: { userId },
			select: { interests: true },
		});
		const complete = new Set(profile?.interests ?? []).size >= 2;
		return {
			complete,
			nextStep: complete ? 'NONE' : 'SELECT_INTERESTS',
		};
	}

	async acknowledgeApproval(ownerId: string) {
		await this.prisma.$transaction(async (tx) => {
			const where = {
				ownerId,
				verificationStatus: 'APPROVED' as const,
				owner: {
					role: 'ORGANIZER' as const,
					status: 'ACTIVE' as const,
					emailVerifiedAt: { not: null },
				},
			};

			const organizations = await tx.organization.findMany({
				where,
				select: { id: true },
				take: 2,
			});

			if (organizations.length !== 1)
				throw new ForbiddenException('Approved organizer access required');

			await tx.organization.updateMany({
				where: {
					...where,
					id: organizations[0]!.id,
					approvalAcknowledgedAt: null,
				},
				data: { approvalAcknowledgedAt: new Date() },
			});

			const confirmed = await tx.organization.findFirst({
				where: {
					...where,
					approvalAcknowledgedAt: { not: null },
				},
				select: { id: true },
			});

			if (!confirmed)
				throw new ForbiddenException('Approval acknowledgment is unavailable');
		});
	}

	async login(email: string, password: string)
	{
		const user = await this.validateCredentials(email, password);

		const token = await this.jwtService.signAsync({
			sub: String(user.id),
		});

		return {
			accessToken: token,
			user,
		};
	}
}