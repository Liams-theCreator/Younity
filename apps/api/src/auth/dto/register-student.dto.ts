import { Transform } from "class-transformer";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, Matches, IsArray, ArrayUnique } from "class-validator";
import {
  AcademicLevel,
  AcademicField,
  Interests,
  OpportunityFormat,
} from '../../generated/prisma/enums.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class RegisterStudentDto {
  @ApiProperty({
    example: 'Abdellah',
    maxLength: 100,
    description:
      'Must contain a letter. Letters, spaces, hyphens, and underscores are allowed',
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
    example: 'Syani',
    maxLength: 100,
    description:
      'Must contain a letter. Letters, spaces, hyphens, and underscores are allowed',
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
    example: 'abdellah@gmail.com',
    format: 'email',
    maxLength: 255,
    description:
      'Trimmed and converted to lowercase',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    example: 'Password123-@@++',
    format: 'password',
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
    description:
      'Password used to create the account',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    type: String,
    example: '1337-coding-school',
    maxLength: 255,
    nullable: true,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  university?: string | null;

  @ApiPropertyOptional({
    enum: AcademicLevel,
    enumName: 'AcademicLevel',
    example: AcademicLevel.FIRST_YEAR,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(AcademicLevel)
  studyLevel?: AcademicLevel | null;

  @ApiPropertyOptional({
    enum: AcademicField,
    enumName: 'AcademicField',
    example: AcademicField.COMPUTER_SCIENCE,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(AcademicField)
  academicField?: AcademicField | null;

  @ApiPropertyOptional({
    enum: Interests,
    enumName: 'Interests',
    isArray: true,
    example: [Interests.HACKATHONS, Interests.AI_DATA],
    description: 'Student interests. Defaults to an empty array when omitted.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Interests, { each: true })
  interests?: Interests[];

  @ApiPropertyOptional({
    enum: OpportunityFormat,
    enumName: 'OpportunityFormat',
    example: OpportunityFormat.IN_PERSON,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(OpportunityFormat)
  opportunityFormat?: OpportunityFormat | null;
}
