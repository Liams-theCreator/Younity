import { Module } from '@nestjs/common';
import { OrganizerEventsService } from './organizer-events.service.js';
import { OrganizerEventsController } from './organizer-events.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [OrganizerEventsController],
  providers: [OrganizerEventsService],
})
export class OrganizerEventsModule {}
