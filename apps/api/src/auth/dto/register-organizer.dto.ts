import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator'

export class RegisterOrganizerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  organizationName!: string;
}
