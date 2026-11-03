import { Module } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service.js';
import { EmailVerificationController } from './email-verification.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [EmailVerificationService],
  controllers: [EmailVerificationController],
  exports: [EmailVerificationService],
})
export class EmailVerificationModule { }
