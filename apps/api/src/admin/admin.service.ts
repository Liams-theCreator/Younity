import { Injectable, ConflictException } from '@nestjs/common';
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
	async approveApplication(applicationId: string,
							adminId: string,
							reason: string) {
		try {
			const result = await this.prisma.organizationApplication.updateMany({
				where: {
					id: applicationId,
					status: 'PENDING',
				},
				data: {
					status: 'APPROVED',
				},
			});
			if (result.count === 0) {
				throw new ConflictException('Application cannot be approved');
			}
			else
				return result.count;
		} catch (error) { throw(error); }
	}
	async rejectApplication(applicationId: string) {
		try {
			const result = await this.prisma.organizationApplication.updateMany({
				where: {
					id: applicationId,
					status: 'PENDING',
				},
				data: {
					status: 'REJECTED',
				},
			});
			if (result.count === 0) {
				throw new ConflictException('Application cannot be rejected');
			}
			else
				return result.count;
		} catch (error) { throw(error); }
	}
	async requestChangesApplication(applicationId: string) {
		try {
			const result = await this.prisma.organizationApplication.updateMany({
				where: {
					id: applicationId,
					status: 'PENDING',
				},
				data: {
					status: 'NEEDS_CHANGES',
				},
			});
			if (result.count === 0) {
				throw new ConflictException('Application cannot be requested for changes');
			}
			else
				return result.count;
		} catch (error) { throw(error); }
	}
}
