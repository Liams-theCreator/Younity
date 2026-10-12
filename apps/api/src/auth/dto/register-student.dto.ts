import { Transform } from "class-transformer";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { StudyLevel, AcademicField, Interests, OpportunityFormat } from "../../generated/prisma/enums.js";

export class RegisterStudentDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  // Do not trim or lowercase passwords.
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  university?: string | null;

  @IsOptional()
  @IsEnum(StudyLevel)
  studyLevel?: StudyLevel | null;

  @IsOptional()
  @IsEnum(AcademicField)
  academicField?: AcademicField | null;

  @IsOptional()
  @IsEnum(Interests)
  interests?: Interests | null;

  @IsOptional()
  @IsEnum(OpportunityFormat)
  opportunityFormat?: OpportunityFormat | null;
}
