import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OrganizerApplicantGuard } from './organizer-applicant.guard.js';
import { OrganizerApplicationsController } from './organizer-applications.controller.js';
import { OrganizerApplicationsService } from './organizer-applications.service.js';

@Module({
	imports: [AuthModule, PrismaModule],
	controllers: [OrganizerApplicationsController],
	providers: [OrganizerApplicationsService, OrganizerApplicantGuard],
})
export class OrganizerApplicationsModule {}
