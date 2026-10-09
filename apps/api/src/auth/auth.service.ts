import { PrismaService } from '../prisma/prisma.service.js'
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService
{
	constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService,
	) {}

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
				},
			});
	}

	async validateCredentials(email: string, password: string)
	{
		const user = await this.findUserForLogin(email);

		if (user === null)
			throw new UnauthorizedException('Invalid credentials');
		const passwordMatches = await argon2.verify(
			user.passwordHash,
			password,
		);
		if (!passwordMatches)
			throw new UnauthorizedException('Invalid credentials');
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
