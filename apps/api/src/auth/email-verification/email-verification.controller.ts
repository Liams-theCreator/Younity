import { Body, Controller, Post, HttpCode, HttpStatus, Header } from '@nestjs/common';
import { EmailVerificationService } from './email-verification.service.js';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { VerifyEmailDto } from '../dto/email-verification.dto.js';

@ApiTags('Email verification')
@Controller('email-verification')
export class EmailVerificationController {
  constructor(private readonly emailverificationService: EmailVerificationService,) { }

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
