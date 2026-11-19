import { IsUrl, IsOptional, IsPhoneNumber, IsEnum, IsString, IsNotEmpty, MaxLength} from 'class-validator'
import { Transform } from 'class-transformer';
import { OrganizationType } from '../../generated/prisma/enums.js';

export class SaveOrganizerDraftDto {
	@IsOptional()
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	organizationName?: string | null;


	@IsEnum(OrganizationType)
	@IsOptional()
	type?: OrganizationType | null;
	
	@IsOptional()
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	representativeFullName?: string | null;

	@IsOptional()
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	academicPosition?: string | null;

	@IsOptional()
	@IsString()
  	@IsPhoneNumber()
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  	@MaxLength(255)
	phoneNumber?: string | null;

	@IsOptional()
	@Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
	@IsString()
  	@MaxLength(512)
	@IsUrl({ protocols: ['http', 'https'], require_protocol: true })
	proofUrl?: string | null;
};

