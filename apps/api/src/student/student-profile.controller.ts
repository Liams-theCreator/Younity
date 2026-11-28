import { Body, Controller, Get, Header, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { StudentProfileService } from './student-profile.service.js';
import { StudentNameDto, UpdateStudentNameDto } from './update-student-name.dto.js';

@ApiTags('Student profile')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'A valid session cookie is required.' })
@ApiForbiddenResponse({ description: 'Requires an active, email-verified student profile.' })
@Controller('student/profile')
@UseGuards(JwtAuthGuard)
export class StudentProfileController {
  constructor(private readonly profile: StudentProfileService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read the signed-in student’s first and last names' })
  @ApiOkResponse({ type: StudentNameDto })
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.profile.getName(user.id);
  }

  @Patch()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Update one or both names for the signed-in student' })
  @ApiOkResponse({ type: StudentNameDto })
  @ApiBadRequestResponse({ description: 'Provide at least one valid name. Unknown fields are rejected.' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateStudentNameDto) {
    return this.profile.updateName(user.id, dto);
  }
}
