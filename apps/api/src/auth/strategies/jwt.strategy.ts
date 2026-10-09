import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../prisma/prisma.service.js'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt')
{
	constructor(
		config: ConfigService,
		private readonly prisma: PrismaService,
	) 
	{
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
			ignoreExpiration: false,
			algorithms: ['HS256'],
		});
	}
	async validate(payload: {sub?: unknown; exp?: unknown})
	{
		if (
			typeof payload.sub !== 'string' ||
			!/^[1-9]\d*$/.test(payload.sub) ||
		typeof payload.exp !== 'number'
		)
		{
			throw new UnauthorizedException();
    		}
		const userId = Number(payload.sub);
		if (!Number.isSafeInteger(userId) || userId > 2147483647)
			throw new UnauthorizedException();
		const user = await this.prisma.user.findUnique({
			where: {id: userId},
			select: {
				id: true,
				email: true,
				role: true,
				organizerApprovalStatus: true,
			},
		});
		if (user === null)
			throw new UnauthorizedException();
		return user;
	}
}
