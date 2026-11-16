import { Module } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service.js';
import { EmailVerificationController } from './email-verification.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { MailModule } from '../mail/mail.module.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { jwtSettings } from '../../config/jwt.js';
import { ResendRateLimitGuard } from '../guards/resend-rate-limit.guard.js';

@Module({
  imports: [PrismaModule, MailModule, JwtModule.registerAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({ secret: jwtSettings(config).secret }),
  })],
  providers: [EmailVerificationService, ResendRateLimitGuard],
  controllers: [EmailVerificationController],
  exports: [EmailVerificationService],
})
export class EmailVerificationModule { }
