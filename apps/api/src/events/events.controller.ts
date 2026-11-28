import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { DiscoveryQueryDto } from './discovery-query.dto.js';
import { EventsService } from './events.service.js';
import { OptionalJwtGuard } from './optional-jwt.guard.js';

@ApiTags('Public events')
@Controller('events')
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(OptionalJwtGuard)
  @ApiOperation({
    summary: 'Search published events and browse the category catalog',
  })
  list(
    @Query() query: DiscoveryQueryDto,
    @Req() request: Request & { user?: AuthenticatedUser },
  ) {
    return this.events.list(query, request.user);
  }

  @Get(':eventId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read a published event by ID' })
  detail(@Param('eventId', new ParseUUIDPipe()) eventId: string) {
    return this.events.detail(eventId);
  }
}
