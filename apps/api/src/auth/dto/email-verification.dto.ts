import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Verification token received in the email link',
    example: 'a'.repeat(64),
    type: String,
    minLength: 64,
    maxLength: 64,
    pattern: '^[a-f0-9]{64}$',
  })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, {
    message: 'Token must contain exactly 64 lowercase hexadecimal characters',
  })
  token!: string;
}
