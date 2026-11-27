import { AdminApplicationsModule } from './admin-applications/admin-applications.module.js';
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
import { EventsModule } from './events/events.module.js';
import { CategoriesController } from './categories.controller.js';
import { OrganizerEventsModule } from './organizer-events/organizer-events.module.js';
import { BookingsModule } from './bookings/bookings.module.js';

@Module({
  imports: [
    AdminApplicationsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuthModule,
    StudentModule,
    OrganizerApplicationsModule,
    AdminModule,
    OrganizerEventsModule,
    EventsModule,
    BookingsModule,
  ],
  controllers: [
    AppController,
    HealthController,
    CategoriesController,
  ],
  providers: [
    AppService,
  ],
})
export class AppModule {}
