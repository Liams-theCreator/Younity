import { Module } from '@nestjs/common';
import { OrganizerApplicationsController } from './organizer-applications.controller';

@Module({
  controllers: [OrganizerApplicationsController]
})
export class OrganizerApplicationsModule {}
