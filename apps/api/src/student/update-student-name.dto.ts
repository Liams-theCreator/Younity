import { PartialType, PickType } from '@nestjs/swagger';
import { RegisterStudentDto } from '../auth/dto/register-student.dto.js';

export class StudentNameDto extends PickType(RegisterStudentDto, [
  'firstName',
  'lastName',
] as const) {}

export class UpdateStudentNameDto extends PartialType(StudentNameDto, {
  skipNullProperties: false,
}) {}
