import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';

const participantStatuses = ['CONFIRMED', 'CANCELLED'] as const;

function positiveInteger(value: unknown): unknown {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value)
    ? Number(value)
    : value;
}

export class ListParticipantsDto {
  @ApiProperty({ enum: participantStatuses })
  @IsIn(participantStatuses)
  status!: (typeof participantStatuses)[number];

  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  })
  @Transform(({ value }) => positiveInteger(value))
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Transform(({ value }) => positiveInteger(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
