import { PrismaService } from '../prisma/prisma.service.js';
import { MailModule } from '../auth/mail/mail.module.js';
import { MailService } from '../auth/mail/mail.service.js';
import { DecisionEmailDispatcher } from './decision-email.dispatcher.js';
import { DecisionEmailWorker } from './decision-email.worker.js';
import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminController } from './admin.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule, MailModule],
  providers: [
    AdminService,
    DecisionEmailWorker,
    {
      provide: DecisionEmailDispatcher,
      inject: [PrismaService, MailService],
      useFactory: (prisma: PrismaService, mail: MailService) =>
        new DecisionEmailDispatcher(prisma, mail),
    },
  ],
  controllers: [AdminController],
})
export class AdminModule {}
