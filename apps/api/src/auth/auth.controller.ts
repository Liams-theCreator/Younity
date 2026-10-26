import { Body, Controller, Post, Get, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { LoginDto } from './dto/login.dto.js';
import { AuthService } from './auth.service.js'
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js'
import type { AuthenticatedUser } from './types/authenticated-user.type.js'
import { Role } from '../generated/prisma/enums.js';
import { Roles } from './decorators/roles.decorator.js';
import { RolesGuard } from './guards/roles.guard.js';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController 
{
	constructor(
		private readonly authService: AuthService,
		private readonly config: ConfigService,

	) {}
	@Post('login')
	@HttpCode(HttpStatus.OK)
	async login(
		@Body() dto: LoginDto,
		@Res({ passthrough: true }) response: Response,
	) 
	{
		const result = await this.authService.login(dto.email, dto.password);
		const ttlSeconds = this.config.getOrThrow<number>('JWT_TTL_SECONDS');
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
	@UseGuards(JwtAuthGuard)
	me(@CurrentUser() user: AuthenticatedUser)
	{
		return {
			id: user.id,
			email: user.email,
		};
	}
	@Get('admin-check')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	adminCheck() {
		return {message: 'admin access granted'}
	}
	@Get('student-check')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.STUDENT, Role.ORGANIZER)
	studentCheck() {
		return { message: 'Student access granted' };
	}

	@Get('organizer-check')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ORGANIZER)
	organizerCheck() {
		return { message: 'Organizer access granted' };
	}
}
