import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, IsUrl, Matches, Max, MaxLength, MinLength } from 'class-validator'
import { Transform } from 'class-transformer';
import { OrganizationType } from '../../generated/prisma/enums.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterOrganizerDto {
  @ApiProperty({
    example: 'Sara',
    maxLength: 100,
    description: 'Letters, spaces, hyphens, and underscores; at least one letter',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^(?=.*\p{L})[\p{L}\p{M} _-]+$/u, {
    message:
      'First name must contain a letter and only letters, spaces, hyphens, or underscores',
  })
  firstName!: string;

  @ApiProperty({
    example: 'Test',
    maxLength: 100,
    description: 'Letters, spaces, hyphens, and underscores; at least one letter',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^(?=.*\p{L})[\p{L}\p{M} _-]+$/u, {
    message:
      'Last name must contain a letter and only letters, spaces, hyphens, or underscores',
  })
  lastName!: string;

  @ApiProperty({
    example: 'organizer@example.com',
    format: 'email',
    maxLength: 255,
    description: 'Trimmed and converted to lowercase',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    example: 'Example-only-password-2026!',
    format: 'password',
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/[A-Z]/, {
    message: 'Password must contain an uppercase letter',
  })
  @Matches(/[a-z]/, {
    message: 'Password must contain a lowercase letter',
  })
  @Matches(/[0-9]/, {
    message: 'Password must contain a number',
  })
  @Matches(/[^\p{L}\p{N}\s]/u, {
    message: 'Password must contain at least one special character',
  })
  password!: string;

  @ApiProperty({
    example: 'Example Student Club',
    maxLength: 255,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  organizationName!: string;

  @ApiProperty({
    enum: OrganizationType,
    enumName: 'OrganizationType',
    example: OrganizationType.STUDENT_CLUB,
  })
  @IsEnum(OrganizationType)
  type!: OrganizationType;

  @ApiProperty({
    example: 'Sara Test',
    maxLength: 255,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  representativeFullName!: string;

  @ApiProperty({
    example: 'Club President',
    maxLength: 255,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  academicPosition!: string;

  @ApiProperty({
    example: '+212612345678',
    description: 'Phone number including its international country code',
    maxLength: 255,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsPhoneNumber()
  @MaxLength(255)
  phoneNumber!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uri',
    example: 'https://example.com/proof.pdf',
    description: 'HTTP or HTTPS URL pointing to an organization proof document',
    maxLength: 512,
    nullable: true,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @MaxLength(512)
  proofUrl?: string | null;
}
