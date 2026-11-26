import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { EventFormat, RegistrationMode } from '../../generated/prisma/enums.js';

export class CreateOrganizerEventDto {
  @ApiProperty({ maxLength: 255 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ enum: EventFormat })
  @IsEnum(EventFormat)
  format!: EventFormat;

  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  startDate!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  endDate!: string;

  @ApiProperty({ enum: RegistrationMode })
  @IsEnum(RegistrationMode)
  registrationMode!: RegistrationMode;

  @ApiPropertyOptional({ type: [String], format: 'uuid', uniqueItems: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayUnique((id: unknown) =>
    typeof id === 'string' ? id.toLowerCase() : id,
  )
  @IsUUID('all', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  onlineUrl?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  imageUrl?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  registrationDeadline?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 2147483647, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  capacity?: number | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  externalRegistrationUrl?: string | null;
}
