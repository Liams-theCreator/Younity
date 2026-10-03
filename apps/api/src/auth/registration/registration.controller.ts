import { Body, Controller, Post } from "@nestjs/common";

@Controller('auth/register')
export class RegistrationControlle {
  @Post('student')
  registerStudent() {
    return this;
  }
  @Post('organizer')
  registerOrganizer() {
    return this;
  }
}
