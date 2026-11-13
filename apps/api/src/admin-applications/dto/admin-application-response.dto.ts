import { ApiProperty } from '@nestjs/swagger';
import {
  OrganizationType,
  VerificationStatus,
} from '../../generated/prisma/enums.js';
import {
  MAX_APPLICATION_LIMIT,
  MAX_APPLICATION_PAGE,
} from './list-admin-applications.dto.js';

export class AdminApplicationSummaryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Application ID, not the organization ID.',
  })
  id: string;

  @ApiProperty()
  orgName: string;

  @ApiProperty()
  representativeFullName: string;

  @ApiProperty({ enum: VerificationStatus })
  status: VerificationStatus;

  @ApiProperty({ format: 'date-time' })
  submittedAt: string;
}

export class ApplicationSubmitterDto {
  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ format: 'email' })
  email: string;
}

export class AdminApplicationDetailDto extends AdminApplicationSummaryDto {
  @ApiProperty({ enum: OrganizationType })
  type: OrganizationType;

  @ApiProperty()
  academicPosition: string;

  @ApiProperty()
  phoneNumber: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Optional supporting document URL.',
  })
  proofUrl: string | null;

  @ApiProperty({ type: ApplicationSubmitterDto })
  submittedBy: ApplicationSubmitterDto;

  @ApiProperty({ type: String, nullable: true })
  reviewerNote: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  reviewedAt: string | null;
}

export class AdminApplicationPageDto {
  @ApiProperty({ type: [AdminApplicationSummaryDto] })
  items: AdminApplicationSummaryDto[];

  @ApiProperty({
    minimum: 0,
    description: 'Eligible applications matching the status filter.',
  })
  total: number;

  @ApiProperty({ minimum: 1, maximum: MAX_APPLICATION_PAGE })
  page: number;

  @ApiProperty({ minimum: 1, maximum: MAX_APPLICATION_LIMIT })
  limit: number;

  @ApiProperty({ minimum: 0 })
  totalPages: number;

  @ApiProperty()
  hasNextPage: boolean;

  @ApiProperty()
  hasPreviousPage: boolean;
}
