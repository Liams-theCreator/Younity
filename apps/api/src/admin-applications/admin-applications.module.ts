import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminApplicationsController } from './admin-applications.controller.js';
import { AdminApplicationsService } from './admin-applications.service.js';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
  ],
  controllers: [AdminApplicationsController],
  providers: [AdminApplicationsService],
})
export class AdminApplicationsModule {}
