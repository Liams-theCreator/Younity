import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OrganizerDashboardController } from './organizer-dashboard.controller.js';
import { OrganizerDashboardService } from './organizer-dashboard.service.js';

@Module({ imports: [AuthModule, PrismaModule], controllers: [OrganizerDashboardController], providers: [OrganizerDashboardService] })
export class OrganizerDashboardModule {}
