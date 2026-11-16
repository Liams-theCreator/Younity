import { Body, Controller, Post, HttpCode, HttpStatus, Header, UseGuards } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service.js';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { VerifyEmailDto } from '../dto/email-verification.dto.js';
import { VerificationRecoveryDto } from '../dto/verification-recovery.dto.js';
import { ResendRateLimitGuard } from '../guards/resend-rate-limit.guard.js';

@ApiTags('Email verification')
@Controller('email-verification')
export class EmailVerificationController {
  constructor(private readonly emailverificationService: EmailVerificationService,) { }

  @Post('recovery-status')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read verification status and stored link expiry using the registration recovery capability' })
  recoveryStatus(@Body() dto: VerificationRecoveryDto) {
    return this.emailverificationService.recoveryStatus(dto.recoveryToken);
  }

  @Post('retry')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ResendRateLimitGuard)
  @ApiOperation({ summary: 'Retry delivery for a newly registered account, after link expiry or a known delivery failure' })
  retryRecovery(@Body() dto: VerificationRecoveryDto) {
    return this.emailverificationService.retryRecovery(dto.recoveryToken);
  }

  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an email address' })
  @ApiOkResponse({
    description: 'Email verified successfully',
    schema: {
      example: { message: 'Email verified successfully.' },
    },
  })
  @ApiBadRequestResponse({
    description: 'Malformed, invalid, expired, or already-used token',
  })
  @Post('verify-email')
  @Header('Cache-Control', 'no-store')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.emailverificationService.verifyEmail(dto);
  }
}
