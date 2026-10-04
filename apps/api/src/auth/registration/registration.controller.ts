import { Body, Controller, Post } from "@nestjs/common";
import { RegistrationService } from "./registration.service.js";
import { RegisterStudentDto } from "../dto/register-student.dto.js";
import { RegisterOrganizerDto } from "../dto/register-organizer.dto.js";

@Controller('auth/register')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService,) { }

  @Post('student')
  registerStudent(@Body() dto: RegisterStudentDto) {
    return this.registrationService.registerStudent(dto);
  }

  @Post('organizer')
  registerOrganizer(@Body() dto: RegisterOrganizerDto) {
    return this.registrationService.registerOrganizer(dto);
  }
}
