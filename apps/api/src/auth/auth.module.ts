import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthService } from './auth.service.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { RegistrationModule } from "./registration/registration.module.js";

@Module({
	imports: [
		RegistrationModule,
		PassportModule.register({
			defaultStrategy: 'jwt',
			session: false,
		}),
		PrismaModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],

			useFactory: (config: ConfigService) => {
				const ttlSeconds = Number(
					config.getOrThrow<string | number>('JWT_TTL_SECONDS'),
				);

				if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
					throw new Error('JWT_TTL_SECONDS must be a positive integer');
				}

				return {
					secret: config.getOrThrow<string>('JWT_SECRET'),
					signOptions: {
						expiresIn: ttlSeconds,
					},
				};
			},
		}),

	],
	controllers: [AuthController],
	providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
