import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  async findApplication(applicationId: string) {
    try {
      return this.prisma.organizationApplication.findUnique({
        where: { id: applicationId },
      });
    } catch (error) {
      throw error;
    }
  }
  async approveApplication(
    applicationId: string,
    adminId: string,
    reason: string,
  ) {
    try {
      return this.prisma.$transaction(async (tx) => {
        const result = await tx.organizationApplication.updateMany({
          where: {
            id: applicationId,
            status: 'PENDING',
          },
          data: {
            status: 'APPROVED',
            reviewerId: adminId,
            reviewerNote: reason,
            reviewedAt: new Date(),
          },
        });
        if (result.count === 0) {
          throw new ConflictException('Application cannot be approved');
        }
        return result.count;
      });
    } catch (error) {
      throw error;
    }
  }
  async rejectApplication(
    applicationId: string,
    adminId: string,
    reason: string,
  ) {
    try {
      const result = await this.prisma.organizationApplication.updateMany({
        where: {
          id: applicationId,
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
          reviewerId: adminId,
          reviewerNote: reason,
          reviewedAt: new Date(),
        },
      });
      if (result.count === 0) {
        throw new ConflictException('Application cannot be rejected');
      } else return result.count;
    } catch (error) {
      throw error;
    }
  }
  async requestChangesApplication(
    applicationId: string,
    adminId: string,
    reason: string,
  ) {
    try {
      const result = await this.prisma.organizationApplication.updateMany({
        where: {
          id: applicationId,
          status: 'PENDING',
        },
        data: {
          status: 'NEEDS_CHANGES',
          reviewerId: adminId,
          reviewerNote: reason,
          reviewedAt: new Date(),
        },
      });
      if (result.count === 0) {
        throw new ConflictException(
          'Application cannot be requested for changes',
        );
      } else return result.count;
    } catch (error) {
      throw error;
    }
  }
}
