import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  AcademicField,
  AcademicLevel,
  Interests,
  OpportunityFormat,
} from '../generated/prisma/enums.js';

export class UpdatePreferencesDto {
  @ApiProperty({
    enum: Interests,
    isArray: true,
    minItems: 2,
    uniqueItems: true,
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(Object.keys(Interests).length)
  @ArrayUnique()
  @IsEnum(Interests, { each: true })
  interests!: Interests[];

  @ApiPropertyOptional({
    type: String,
    maxLength: 255,
    nullable: true,
    description: 'Omit to preserve; null clears the value.',
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
    enum: AcademicField,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(AcademicField)
  academicField?: AcademicField | null;

  @ApiPropertyOptional({
    enum: AcademicLevel,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(AcademicLevel)
  studyLevel?: AcademicLevel | null;

  @ApiPropertyOptional({
    enum: OpportunityFormat,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(OpportunityFormat)
  opportunityFormat?: OpportunityFormat | null;
}
