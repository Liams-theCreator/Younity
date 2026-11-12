import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
	imports: [PrismaModule],
	providers: [AdminService]
})
export class AdminModule {}
