import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, MaxLength } from 'class-validator';

export class VerificationRecoveryDto {
  @ApiProperty({ description: 'Scoped recovery token returned only when creating this account. Cannot verify email or authenticate a session.' })
  @IsJWT()
  @MaxLength(2048)
  recoveryToken!: string;
}
