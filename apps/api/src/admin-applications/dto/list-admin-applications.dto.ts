import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { VerificationStatus } from '../../generated/prisma/enums.js';

export const DEFAULT_APPLICATION_LIMIT = 20;
export const MAX_APPLICATION_LIMIT = 100;
export const MAX_APPLICATION_PAGE = 1_000_000;

function positiveInteger(value: unknown): unknown {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value)
    ? Number(value)
    : value;
}

export class ListAdminApplicationsDto {
  @ApiPropertyOptional({
    type: Number,
    default: 1,
    minimum: 1,
    maximum: MAX_APPLICATION_PAGE,
    description:
      'One-based page number. Out-of-range pages return empty items.',
  })
  @Transform(({ value }) => positiveInteger(value))
  @IsInt()
  @Min(1)
  @Max(MAX_APPLICATION_PAGE)
  page = 1;

  @ApiPropertyOptional({
    type: Number,
    default: DEFAULT_APPLICATION_LIMIT,
    minimum: 1,
    maximum: MAX_APPLICATION_LIMIT,
  })
  @Transform(({ value }) => positiveInteger(value))
  @IsInt()
  @Min(1)
  @Max(MAX_APPLICATION_LIMIT)
  limit = DEFAULT_APPLICATION_LIMIT;

  @ApiPropertyOptional({
    enum: VerificationStatus,
    description: 'Exact application review status. Omit for all four statuses.',
  })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
}
