import { Body, Controller, Post, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { LoginDto } from './dto/login.dto.js';
import { AuthService } from './auth.service.js'
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js'
import type { AuthenticatedUser } from './types/authenticated-user.type.js'
import { Role } from '../generated/prisma/enums.js';
import { Roles } from './decorators/roles.decorator.js';
import { RolesGuard } from './guards/roles.guard.js';

@Controller('auth')
export class AuthController 
{
	constructor(private readonly authService: AuthService) {}
	@Post('login')
	@HttpCode(HttpStatus.OK)
	login(@Body() dto: LoginDto) 
	{
		return this.authService.login(dto.email, dto.password);
	}
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
	@Roles(Role.STUDENT)
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
