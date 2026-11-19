import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { UserRole, UserStatus } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListAdminApplicationsDto } from './dto/list-admin-applications.dto.js';
import type {
  AdminApplicationDetailDto,
  AdminApplicationPageDto,
  AdminApplicationSummaryDto,
} from './dto/admin-application-response.dto.js';

const summarySelect = {
  id: true,
  status: true,
  submittedAt: true,
  organization: { select: { orgName: true, representativeFullName: true } },
} satisfies Prisma.OrganizationApplicationSelect;

const detailSelect = {
  ...summarySelect,
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
  submittedBy: { select: { firstName: true, lastName: true, email: true } },
  reviewerNote: true,
  reviewedAt: true,
} satisfies Prisma.OrganizationApplicationSelect;

type SelectedSummary = Prisma.OrganizationApplicationGetPayload<{
  select: typeof summarySelect;
}>;

function summary(row: SelectedSummary): AdminApplicationSummaryDto {
  return {
    id: row.id,
    orgName: row.organization.orgName,
    representativeFullName: row.organization.representativeFullName,
    status: row.status,
    submittedAt: row.submittedAt.toISOString(),
  };
}

// Current-schema compatibility rule, isolated for the pending S2-03 handoff:
// an application row is a submission; organization-only drafts have no row.
// The published onboarding handoff requires verified email and complete fields.
// Update this predicate when the final draft/submission migration is available.
function eligibleApplications(): Prisma.OrganizationApplicationWhereInput {
  return {
    submittedAt: { lte: new Date() },
    submittedBy: {
      role: UserRole.ORGANIZER,
      status: { in: [UserStatus.PENDING, UserStatus.ACTIVE] },
      emailVerifiedAt: { not: null },
    },
    organization: {
      orgName: { not: '' },
      representativeFullName: { not: '' },
      academicPosition: { not: '' },
      phoneNumber: { not: '' },
    },
  };
}

function assertAdministrator(user: AuthenticatedUser) {
  if (user.role !== UserRole.ADMIN || user.status !== UserStatus.ACTIVE) {
    throw new ForbiddenException('An active administrator account is required');
  }
}

@Injectable()
export class AdminApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListAdminApplicationsDto,
    user: AuthenticatedUser,
  ): Promise<AdminApplicationPageDto> {
    assertAdministrator(user);
    const { page, limit, status } = query;
    const where: Prisma.OrganizationApplicationWhereInput = {
      ...eligibleApplications(),
      ...(status === undefined ? {} : { status }),
    };

    // Keep count and page consistent when a concurrent decision changes status.
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.organizationApplication.findMany({
          where,
          select: summarySelect,
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        });
        const total = await tx.organizationApplication.count({ where });
        return {
          items: rows.map(summary),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async detail(
    id: string,
    user: AuthenticatedUser,
  ): Promise<AdminApplicationDetailDto> {
    assertAdministrator(user);
    const row = await this.prisma.organizationApplication.findFirst({
      where: { ...eligibleApplications(), id },
      select: detailSelect,
    });
    if (!row) throw new NotFoundException('Application not found');
    return {
      id: row.id,
      orgName: row.organization.orgName,
      representativeFullName: row.organization.representativeFullName,
      status: row.status,
      submittedAt: row.submittedAt.toISOString(),
      type: row.organization.type,
      academicPosition: row.organization.academicPosition,
      phoneNumber: row.organization.phoneNumber,
      proofUrl: row.organization.proofUrl,
      submittedBy: row.submittedBy,
      reviewerNote: row.reviewerNote,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    };
  }
}
