import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class AdminDecisionDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	@Transform(({ value }) =>
			   typeof value === 'string' ? value.trim() : value
			  )
			  reason!: string;
}
