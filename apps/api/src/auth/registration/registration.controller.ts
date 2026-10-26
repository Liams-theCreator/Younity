import { Body, Controller, Post } from "@nestjs/common";
import { RegistrationService } from "./registration.service.js";
import { RegisterStudentDto } from "../dto/register-student.dto.js";
import { RegisterOrganizerDto } from "../dto/register-organizer.dto.js";
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';

@ApiTags('Registration')
@Controller('auth/register')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService,) { }

  @Post('student')
  /************************** Swagger Documentation ********************************************/
  @ApiOperation({
    summary: 'Register a student',
    description:
      'Creates a student user and linked profile. Does not issue login tokens.',
  })
  @ApiBody({
    type: RegisterStudentDto,
  })
  @ApiCreatedResponse({
    description:
      'Student account and profile created successfully. Password hash is excluded.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid or missing fields, or unexpected properties in the request.',
  })
  @ApiConflictResponse({
    description: 'Email is already registered.',
  })

  /*****************************************************************************/
  /**                                                          **/
  /*****************************************************************************/
  registerStudent(@Body() dto: RegisterStudentDto) {
    return this.registrationService.registerStudent(dto);
  }

  @Post('organizer')
  @ApiOperation({
    summary: 'Register an organizer',
    description:
      'Creates an organizer user and a linked organization pending verification. Does not issue login tokens.',
  })
  @ApiBody({
    type: RegisterOrganizerDto,
  })
  @ApiCreatedResponse({
    description:
      'Organizer account and pending organization created. Password hash is excluded.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid, missing, or unexpected request fields.',
  })
  @ApiConflictResponse({
    description: 'Email is already registered.',
  })
  registerOrganizer(@Body() dto: RegisterOrganizerDto) {
    return this.registrationService.registerOrganizer(dto);
  }
}
