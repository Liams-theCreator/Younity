import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { UserRole } from '../generated/prisma/enums.js';
import { OrganizerEventsService } from './organizer-events.service.js';
import { CreateOrganizerEventDto } from './dto/create-organizer-event.dto.js';
import { UpdateOrganizerEventDto } from './dto/update-organizer-event.dto.js';

@ApiTags('Organizer events')
@ApiCookieAuth()
@Controller('organizer-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER)
export class OrganizerEventsController {
  constructor(
    private readonly organizerEventsService: OrganizerEventsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Save a new event as a draft' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizerEventDto,
  ) {
    return this.organizerEventsService.create(user.id, dto);
  }

  @Post('publish')
  @ApiOperation({
    summary: 'Create and publish an event from a completed form',
    description:
      'Sets PUBLISHED directly. Requires a future start date, location for in-person/hybrid events, onlineUrl for online/hybrid events, and externalRegistrationUrl for external registration.',
  })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizerEventDto,
  ) {
    return this.organizerEventsService.publish(user.id, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish the saved event draft without changing its fields',
    description:
      'No body required. Validates the persisted form and changes DRAFT to PUBLISHED. Returns 409 for an already published event or a concurrent change.',
  })
  publishDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.organizerEventsService.publishDraft(user.id, id);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Load an event belonging to the signed-in organizer',
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.organizerEventsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Save changes to an existing event draft' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrganizerEventDto,
  ) {
    return this.organizerEventsService.update(user.id, id, dto);
  }
}
