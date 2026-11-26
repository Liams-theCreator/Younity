import { AdminApplicationsModule } from './admin-applications/admin-applications.module.js';
import { EventImagesModule } from './event-images/event-images.module.js';
import { OrganizerDashboardModule } from './organizer-dashboard/organizer-dashboard.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { validateEnvironment } from './config/environment.js';
import { AuthModule } from './auth/auth.module.js';
import { StudentModule } from './student/student.module.js';
import { OrganizerApplicationsModule } from './organizer-applications/organizer-applications.module.js';
import { AdminModule } from './admin/admin.module.js';

@Module({
  imports: [
    AdminApplicationsModule,
    EventImagesModule,
    OrganizerDashboardModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuthModule,
    StudentModule,
    OrganizerApplicationsModule,
    AdminModule,
  ],
  controllers: [
    AppController,
    HealthController,
  ],
  providers: [
    AppService,
  ],
})
export class AppModule {}
