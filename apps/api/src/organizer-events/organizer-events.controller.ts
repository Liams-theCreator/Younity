import {
  Body,
  Controller,
  Get,
  Header,
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
