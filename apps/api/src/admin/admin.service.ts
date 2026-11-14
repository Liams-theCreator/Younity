import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { submittedApplicationEligibility } from './application-eligibility.js';
type Decision = 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES';
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  findApplication(id: string) {
    return this.prisma.organizationApplication.findUnique({ where: { id } });
  }
  async getApplication(id: string) {
    // Content and revision must describe the same database snapshot; fetching
    // them separately can associate old displayed content with a newer revision.
    return this.prisma.$transaction(
      async (tx) => {
        const application = await tx.organizationApplication.findFirst({
          where: { id, ...submittedApplicationEligibility() },
          include: {
            decisions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
            organization: {
              select: {
                orgName: true,
                representativeFullName: true,
                type: true,
                academicPosition: true,
                phoneNumber: true,
                proofUrl: true,
              },
            },
            submittedBy: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        });
        if (!application) throw new NotFoundException('Application not found');
        return application;
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  approveApplication(
    id: string,
    adminId: string,
    reason: string,
    expectedRevision: number,
  ) {
    return this.decide(id, adminId, reason, 'APPROVED', expectedRevision);
  }
  rejectApplication(
    id: string,
    adminId: string,
    reason: string,
    expectedRevision: number,
  ) {
    return this.decide(id, adminId, reason, 'REJECTED', expectedRevision);
  }
  requestChangesApplication(
    id: string,
    adminId: string,
    reason: string,
    expectedRevision: number,
  ) {
    return this.decide(id, adminId, reason, 'NEEDS_CHANGES', expectedRevision);
  }
  private async decide(
    id: string,
    adminId: string,
    reason: string,
    status: Decision,
    expectedRevision: number,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        // First write gates competing decisions; all dependent writes use tx.
        const result = await tx.organizationApplication.updateMany({
          where: {
            id,
            status: 'PENDING',
            revision: expectedRevision,
            ...submittedApplicationEligibility(now),
          },
          data: {
            status,
            reviewerId: adminId,
            reviewerNote: reason,
            reviewedAt: now,
          },
        });
        const application = await tx.organizationApplication.findUnique({
          where: { id },
        });
        if (!application) throw new NotFoundException('Application not found');
        if (result.count !== 1)
          throw new ConflictException(
            'Application is ineligible, not pending or revision is stale',
          );
        const organization = await tx.organization.findUnique({
          where: { id: application.organizationId },
        });
        if (!organization)
          throw new ConflictException('Application organization is missing');
        const owner = await tx.user.findUnique({
          where: { id: organization.ownerId },
        });
        if (!owner)
          throw new ConflictException('Organization owner is missing');
        if (status === 'APPROVED') {
          const orgResult = await tx.organization.updateMany({
            where: { id: organization.id, ownerId: owner.id },
            data: {
              verificationStatus: 'APPROVED',
              verifiedAt: now,
              verifiedById: adminId,
            },
          });
          if (orgResult.count !== 1)
            throw new ConflictException('Organization changed during review');
          const ownerResult = await tx.user.updateMany({
            where: {
              id: owner.id,
              role: 'ORGANIZER',
              status: { in: ['PENDING', 'ACTIVE'] },
            },
            data: { status: 'ACTIVE' },
          });
          if (ownerResult.count !== 1)
            throw new ConflictException(
              'Owner must be a non-suspended organizer',
            );
        }
        const decision = await tx.applicationDecision.create({
          data: {
            applicationId: id,
            revision: expectedRevision,
            adminId,
            oldStatus: 'PENDING',
            newStatus: status,
            reason,
            createdAt: now,
          },
        });
        await tx.decisionEmail.create({
          data: { decisionId: decision.id, recipient: owner.email },
        });
        return result.count;
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'Concurrent decision; reload the application',
        );
      }
      throw error;
    }
  }
}
