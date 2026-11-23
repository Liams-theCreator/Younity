import { Module } from '@nestjs/common';
import { OrganizerEventsService } from './organizer-events.service.js';
import { OrganizerEventsController } from './organizer-events.controller.js';

@Module({
  controllers: [OrganizerEventsController],
  providers: [OrganizerEventsService],
})
export class OrganizerEventsModule {}
