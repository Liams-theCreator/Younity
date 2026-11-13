import { IsString } from 'class-validator';

export class AdminDecisionDto {
  @IsString()
  reason!: string;
}
