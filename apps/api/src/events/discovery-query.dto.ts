import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EventFormat } from '../generated/prisma/enums.js';

const calendarDate = /^\d{4}-\d{2}-\d{2}$/;

function trimmed(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class DiscoveryQueryDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  q?: string;

  @ApiPropertyOptional({ maxLength: 120, description: 'Category slug' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @Transform(({ value }) => trimmed(value))
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ enum: EventFormat })
  @IsOptional()
  @IsEnum(EventFormat)
  format?: EventFormat;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @Matches(calendarDate)
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @Matches(calendarDate)
  @IsDateString({ strict: true })
  to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number;

  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
