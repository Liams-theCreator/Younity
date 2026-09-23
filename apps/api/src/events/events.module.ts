import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js'
import { EventsService } from './events.service.js';

@Module({
	imports: [PrismaModule],
  providers: [EventsService],
})
export class EventsModule {}
