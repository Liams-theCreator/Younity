import { Body, Controller, Header, Post, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from '@nestjs/platform-express';
import { RegistrationService } from "./registration.service.js";
import { RegisterStudentDto } from "../dto/register-student.dto.js";
import { RegisterOrganizerDto } from "../dto/register-organizer.dto.js";
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiConsumes,
} from '@nestjs/swagger';

import type { Response } from 'express';
import { proofUploadLimits, readProofUpload } from '../../organizer-applications/organizer-proof.js';
import type { ProofUpload } from '../../organizer-applications/organizer-proof.js';
import {
  REGISTRATION_VERIFICATION_COOKIE,
  registrationVerificationCookieOptions,
  VERIFICATION_RECOVERY_TTL_SECONDS,
} from '../email-verification/settings.js';

@ApiTags('Registration')
@Controller('auth/register')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService,) { }

  private rememberRegistration(response: Response, recoveryToken: string) {
    response.cookie(REGISTRATION_VERIFICATION_COOKIE, recoveryToken, {
      ...registrationVerificationCookieOptions,
      maxAge: VERIFICATION_RECOVERY_TTL_SECONDS * 1000,
    });
  }

  @Post('student')
  @Header('Cache-Control', 'no-store')
  /************************** Swagger Documentation ********************************************/
  @ApiOperation({
    summary: 'Register a student',
    description:
      'Creates a student user and linked profile. Does not issue login tokens.',
  })
  @ApiBody({
    type: RegisterStudentDto,
  })
  @ApiCreatedResponse({
    description:
      'Account created. verificationEmailSent indicates delivery success; if false, retry immediately using the returned verificationRecoveryToken at POST /api/email-verification/retry. verificationExpiresAt is the stored 10-minute link deadline; resends wait until it expires. Email-only public recovery is also available at POST /api/auth/resend-verification. Email verification is required before login. Password hash is excluded.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid or missing fields, or unexpected properties in the request.',
  })
  @ApiConflictResponse({
    description: 'Email is already registered.',
  })

  /*****************************************************************************/
  /**                                                          **/
  /*****************************************************************************/
  async registerStudent(@Body() dto: RegisterStudentDto, @Res({ passthrough: true }) response: Response) {
    const registration = await this.registrationService.registerStudent(dto);
    this.rememberRegistration(response, registration.verificationRecoveryToken);
    return registration;
  }

  @Post('organizer')
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(FileInterceptor('proof', { limits: proofUploadLimits }))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({
    summary: 'Register an organizer',
    description:
      'Creates an organizer user and a linked organization pending verification. Does not issue login tokens.',
  })
  @ApiBody({
    type: RegisterOrganizerDto,
  })
  @ApiCreatedResponse({
    description:
      'Account and pending organization created. verificationEmailSent indicates delivery success; if false, retry immediately using the returned verificationRecoveryToken at POST /api/email-verification/retry. verificationExpiresAt is the stored 10-minute link deadline; resends wait until it expires. Email-only public recovery is also available at POST /api/auth/resend-verification. Email verification is required before login and does not approve the organization. Password hash is excluded.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid, missing, or unexpected request fields.',
  })
  @ApiConflictResponse({
    description: 'Email is already registered.',
  })
  async registerOrganizer(
    @Body() dto: RegisterOrganizerDto,
    @Res({ passthrough: true }) response: Response,
    @UploadedFile() file?: ProofUpload,
  ) {
    const registration = await this.registrationService.registerOrganizer(dto, file && readProofUpload(file));
    this.rememberRegistration(response, registration.verificationRecoveryToken);
    return registration;
  }
}
