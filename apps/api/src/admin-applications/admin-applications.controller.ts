import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { UserRole } from '../generated/prisma/enums.js';
import { AdminApplicationsService } from './admin-applications.service.js';
import {
  AdminApplicationDetailDto,
  AdminApplicationPageDto,
} from './dto/admin-application-response.dto.js';
import { ListAdminApplicationsDto } from './dto/list-admin-applications.dto.js';

@ApiTags('Admin application reviews')
@ApiCookieAuth()
@ApiUnauthorizedResponse({
  description: 'Missing, invalid, or expired access_token session cookie.',
})
@ApiForbiddenResponse({
  description: 'Requires an active, email-verified ADMIN account.',
})
@Controller('admin/applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminApplicationsController {
  constructor(private readonly applications: AdminApplicationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List eligible submitted organizer applications',
    description:
      'Current-schema application rows with verified, non-suspended organizer submitters and complete required organization fields. Organization-only drafts are absent. Sorted by submittedAt descending, then id descending. S2-03 lifecycle handoff remains pending.',
  })
  @ApiOkResponse({ type: AdminApplicationPageDto })
  @ApiBadRequestResponse({
    description:
      'Invalid page, limit, status, duplicate query parameters, or unknown query fields.',
  })
  list(
    @Query() query: ListAdminApplicationsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.list(query, user);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Read an eligible submitted application by application ID',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'Organization application UUID.',
  })
  @ApiOkResponse({ type: AdminApplicationDetailDto })
  @ApiBadRequestResponse({ description: 'Application ID is not a UUID.' })
  @ApiNotFoundResponse({
    description:
      'Unknown application ID or application excluded by the eligibility rule.',
  })
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applications.detail(id, user);
  }
}
