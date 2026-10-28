import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';

import { PrismaService } from '../../prisma/prisma.service.js'
import { ForbiddenException } from '@nestjs/common';
import { UserStatus } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../types/authenticated-user.type.js';
import { isUUID } from 'class-validator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt')
{
	constructor(
		config: ConfigService,
		private readonly prisma: PrismaService,
	)
	{
		super({
			jwtFromRequest: (
				request: { cookies?: Record<string, unknown> },
			): string | null => {
				const token = request?.cookies?.access_token;

				return typeof token === 'string' && token.length > 0
					? token
					: null;
			},

			secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
			ignoreExpiration: false,
			algorithms: ['HS256'],
		});
	}
	async validate(
		payload: { sub?: unknown; exp?: unknown },
	): Promise<AuthenticatedUser> {
		if (
			typeof payload.sub !== 'string' ||
			!isUUID(payload.sub) ||
		typeof payload.exp !== 'number' ||
	!Number.isFinite(payload.exp)
		) {
			throw new UnauthorizedException();
		}

		const user = await this.prisma.user.findUnique({
			where: {
				id: payload.sub,
			},
			select: {
				id: true,
				email: true,
				role: true,
				status: true,
				ownedOrganizations: {
					select: {
						id: true,
						verificationStatus: true,
					},
				},
			},
		});

		if (user === null) {
			throw new UnauthorizedException();
		}

		if (user.status === UserStatus.SUSPENDED) {
			throw new ForbiddenException('Account suspended');
		}

		return user;
	}
}
