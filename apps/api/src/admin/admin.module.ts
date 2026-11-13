import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminController } from './admin.controller.js';

@Module({
	imports: [PrismaModule],
	providers: [AdminService],
	controllers: [AdminController]
})
export class AdminModule {}
