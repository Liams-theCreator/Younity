import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminService {
	constructor(private readonly prisma: PrismaService) {}
	async findApplication(applicationId: string) {
		try {
			return this.prisma.organizationApplication.findUnique({
				where: { id: applicationId }
			})
		} catch(error) {
			throw error;
		}
	}
}
