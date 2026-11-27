import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { UserRole } from '../generated/prisma/enums.js';
import { BookingsService } from './bookings.service.js';
import { ListParticipantsDto } from './list-participants.dto.js';

@ApiTags('Bookings')
@ApiCookieAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('events/:eventId/my-booking')
  @Header('Cache-Control', 'no-store')
  @Roles(UserRole.STUDENT)
  getOwnBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.bookings.getOwnBooking(user, eventId);
  }

  @Post('events/:eventId/my-booking')
  @Header('Cache-Control', 'no-store')
  @Roles(UserRole.STUDENT)
  reserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.bookings.changeBooking(user, eventId, 'reserve');
  }

  @Delete('events/:eventId/my-booking')
  @Header('Cache-Control', 'no-store')
  @Roles(UserRole.STUDENT)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.bookings.changeBooking(user, eventId, 'cancel');
  }

  @Get('organizer/bookings')
  @Header('Cache-Control', 'no-store')
  @Roles(UserRole.ORGANIZER)
  listParticipants(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListParticipantsDto,
  ) {
    return this.bookings.listParticipants(user.id, query);
  }
}
