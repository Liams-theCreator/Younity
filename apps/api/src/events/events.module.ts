import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';
import { OptionalJwtGuard } from './optional-jwt.guard.js';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [EventsController],
  providers: [EventsService, OptionalJwtGuard],
})
export class EventsModule {}
