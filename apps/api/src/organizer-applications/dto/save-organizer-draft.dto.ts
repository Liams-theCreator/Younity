import { IsUrl, IsOptional, IsPhoneNumber, IsEnum, IsString, ValidateIf, IsNotEmpty, MaxLength} from 'class-validator'
import { Transform } from 'class-transformer';
import { OrganizationType } from '../../generated/prisma/enums.js';

export class SaveOrganizerDraftDto {
	@ValidateIf((_dto, value) => value !== undefined)
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	organizationName?: string;


	@IsEnum(OrganizationType)
	@ValidateIf((_dto, value) => value !== undefined)
	type?: OrganizationType;
	
	@ValidateIf((_dto, value) => value !== undefined)
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	representativeFullName?: string;

	@ValidateIf((_dto, value) => value !== undefined)
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	academicPosition?: string;

	@ValidateIf((_dto, value) => value !== undefined)
	@IsString()
  	@IsPhoneNumber()
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  	@MaxLength(255)
	phoneNumber?: string;

	@IsOptional()
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
  	@MaxLength(512)
	@IsUrl({ protocols: ['http', 'https'], require_protocol: true })
	proofUrl?: string | null;
};

