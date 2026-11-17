import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class AdminDecisionDto {
  @ApiProperty({ minimum: 1, maximum: 2147483647, example: 2 })
  @IsInt()
  @Max(2147483647)
  @Min(1)
  expectedRevision!: number;
  @ApiProperty({ minLength: 1, maxLength: 100, example: 'Documents verified' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason!: string;
}
