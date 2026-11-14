import { jwtSettings } from '../config/jwt.js';
import { Body, Controller, Post, Get, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { LoginDto } from './dto/login.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { ResendRateLimitGuard } from './guards/resend-rate-limit.guard.js';
import { AuthService } from './auth.service.js'
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js'
import type { AuthenticatedUser } from './types/authenticated-user.type.js'
import { UserRole } from '../generated/prisma/enums.js';
import { Roles } from './decorators/roles.decorator.js';
import { RolesGuard } from './guards/roles.guard.js';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException, Header } from '@nestjs/common';
import { EmailVerificationService } from './email-verification/email-verification.service.js';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('auth')
export class AuthController
{
	constructor(
		private readonly authService: AuthService,
		private readonly config: ConfigService,
		private readonly emailVerification: EmailVerificationService,

	) {}
	@Post('resend-verification')
	@ApiOperation({ summary: 'Request a verification email using only the account email' })
	@ApiResponse({ status: 200, description: 'Identical response for eligible, unknown, verified, suspended, cooldown-suppressed and failed-delivery addresses.', schema: { example: { message: 'If this address belongs to an account awaiting verification, check your inbox.' } } })
	@ApiResponse({ status: 400, description: 'Invalid email or unexpected fields, including password.' })
	@ApiResponse({ status: 429, description: 'Request limit exceeded (30 requests per IP per minute), independent of account status. Retry-After is provided.' })
	@UseGuards(ResendRateLimitGuard)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async resendVerification(@Body() dto: ResendVerificationDto) {
		return this.emailVerification.resendVerification(dto.email);
	}
	@Post('login')
	@HttpCode(HttpStatus.OK)
	async login(
		@Body() dto: LoginDto,
		@Res({ passthrough: true }) response: Response,
	)
	{
		const result = await this.authService.login(dto.email, dto.password);
		const { ttl: ttlSeconds } = jwtSettings(this.config);
		response.cookie('access_token', result.accessToken, {
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			path: '/',
			maxAge: ttlSeconds * 1000,
		});
		response.setHeader('Cache-Control', 'no-store');
		return {user: result.user};
	}
	@Post('logout')
	@HttpCode(HttpStatus.NO_CONTENT)
	logout(@Res({ passthrough: true }) response: Response,): void {
		response.clearCookie('access_token', {
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			path: '/',
		});
		response.setHeader('Cache-Control', 'no-store');
	};

	@Get('me')
	@Header('Cache-Control', 'no-store')
	@UseGuards(JwtAuthGuard)
	me(@CurrentUser() user: AuthenticatedUser) {
		let organization: {
			verificationStatus:
				AuthenticatedUser['ownedOrganizations'][number]['verificationStatus'];
		} | null = null;

		if (user.role === UserRole.ORGANIZER) {
			if (user.ownedOrganizations.length !== 1) {
				throw new InternalServerErrorException(
					'Organization context is not configured',
				);
			}

			const [ownedOrganization] = user.ownedOrganizations;

			if (!ownedOrganization) {
				throw new InternalServerErrorException(
					'Organization context is not configured',
				);
			}

			organization = {
				verificationStatus: ownedOrganization.verificationStatus,
			};
		}

		return {
			id: user.id,
			email: user.email,
			role: user.role,
			status: user.status,
			organization,
		};
}
	@Get('admin-check')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN)
	adminCheck() {
		return {message: 'admin access granted'}
	}
	@Get('student-check')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.STUDENT, UserRole.ORGANIZER)
	studentCheck() {
		return { message: 'Student access granted' };
	}

	@Get('organizer-check')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ORGANIZER)
	organizerCheck() {
		return { message: 'Organizer access granted' };
	}
}
