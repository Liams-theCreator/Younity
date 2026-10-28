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
		return this.prisma.user.findUnique(
			{
				where: {
					email: normalizedEmail,
				},
				select: {
					id: true,
					email: true,
					passwordHash: true,
					status: true,
				},
			});
	}

	async validateCredentials(email: string, password: string)
	{
		const user = await this.findUserForLogin(email);

		const hashToCheck = user?.passwordHash ?? this.dummyPasswordHash;
		const passwordMatches = await argon2.verify(
			hashToCheck,
			password,
		);
		if (!passwordMatches || user == null)
			throw new UnauthorizedException('Invalid credentials');
		if (user.status === UserStatus.SUSPENDED)
			throw new ForbiddenException('Account suspended');
		return {
			id: user.id,
			email: user.email,
		};
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
