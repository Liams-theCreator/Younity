import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StudentPreferencesController } from './student-preferences.controller.js';
import { StudentPreferencesService } from './student-preferences.service.js';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
      session: false,
    }),
  ],
  controllers: [
    StudentPreferencesController,
  ],
  providers: [
    StudentPreferencesService,
  ],
})
export class StudentModule {}