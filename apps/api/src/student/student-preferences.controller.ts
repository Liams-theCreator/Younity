import {
  Body,
  Controller,
  Header,
  Patch,
  UseGuards,
} from '@nestjs/common';
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
import { StudentPreferencesService } from './student-preferences.service.js';
import { UpdatePreferencesDto } from './update-preferences.dto.js';

@ApiTags('Student preferences')
@ApiCookieAuth()
@Controller('student/preferences')
@UseGuards(JwtAuthGuard)
export class StudentPreferencesController {
  constructor(
    private readonly preferences: StudentPreferencesService,
  ) {}

  @Patch()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Save the signed-in student’s interests and optional academic preferences',
  })
  @ApiOkResponse({
    description:
      'Saved preferences. This response does not itself mark onboarding complete.',
  })
  @ApiBadRequestResponse({
    description:
      'Requires at least two distinct supported interests; unknown fields are rejected. Optional fields may be omitted; null clears them.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Missing, invalid or expired session cookie.',
  })
  @ApiForbiddenResponse({
    description:
      'Requires an active, email-verified student with an existing profile.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.preferences.update(user.id, dto);
  }
}