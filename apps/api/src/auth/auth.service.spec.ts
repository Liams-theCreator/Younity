import { describe, expect, it, vi } from 'vitest';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService.validateCredentials', () => {
	it ('returns only safe user fields for correct credentials', async () => {
		const password = 'test-password';
		const databaseUser = {
			id : 1,
			email: 'aadel@example.com',
			passwordHash: await argon2.hash(password),
			emailVerifiedAt: new Date(),
		};
		const prismaMock = {
			user: {
				findUnique: vi.fn().mockResolvedValue(databaseUser),
			},
		};
		const service = new AuthService(
			prismaMock as unknown as PrismaService,
			new JwtService(),
		);
		await service.onModuleInit();
		const usr = await service.validateCredentials(databaseUser.email, password);
		expect(usr).toEqual({
			id: databaseUser.id,
			email: databaseUser.email,
		});
	});
	it ('rejects an incorrect password.', async () => {
		const password = 'test-password';
		const databaseUser = {
			id : 2,
			email: 'leda@example.com',
			passwordHash: await argon2.hash(password),
			emailVerifiedAt: new Date(),
		};
		const prismaMock = {
			user: {
				findUnique: vi.fn().mockResolvedValue(databaseUser),
			},
		};
		const service = new AuthService(
			prismaMock as unknown as PrismaService,
			new JwtService(),
		);
		await service.onModuleInit();
		await expect (service.validateCredentials(databaseUser.email, 'wrong-password'),).rejects.toThrow(UnauthorizedException);
	});
	it('blocks login for unverified accounts but allows credential checks for resend', async () => {
		const user = { id: 'user-id', email: 'student@example.test', passwordHash: await argon2.hash('password'), emailVerifiedAt: null, status: 'ACTIVE' };
		const service = new AuthService({ user: { findUnique: vi.fn().mockResolvedValue(user) } } as unknown as PrismaService, new JwtService());
		await service.onModuleInit();
		await expect(service.login(user.email, 'password')).rejects.toMatchObject({ response: { code: 'EMAIL_NOT_VERIFIED' } });
		await expect(service.validateCredentials(user.email, 'password', false)).resolves.toEqual({ id: user.id, email: user.email });
		await expect(service.validateCredentials(user.email, 'wrong', false)).rejects.toBeInstanceOf(UnauthorizedException);
	});
	it('rejects an unknown email with a generic error', async () => {
		const prismaMock = {
			user: {
				findUnique: vi.fn().mockResolvedValue(null),
			},
		};

		const service = new AuthService(
			prismaMock as unknown as PrismaService,
			new JwtService(),
		);

		await service.onModuleInit();

		await expect(service.validateCredentials('unknown@example.com', 'password')).rejects.toMatchObject({
			status: 401,
			message: 'Invalid credentials',
		});
	});
});
