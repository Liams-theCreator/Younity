import { Body, Controller, Post } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service.js';

@Controller('email-verification')
export class EmailVerificationController {
  constructor(private readonly emailverificationService: EmailVerificationController,) { }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.emailverificationService.verifyEmail(dto.token);
  }
}
