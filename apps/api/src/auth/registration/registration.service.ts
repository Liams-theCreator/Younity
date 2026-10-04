import { Injectable, Post } from "@nestjs/common";
import { RegisterOrganizerDto } from "../dto/register-organizer.dto.js";
import { RegisterStudentDto } from "../dto/register-student.dto.js";

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService) { }

  async registerStudent(dto: RegisterStudentDto) {

  }

  async registerOrganizer(dto: RegisterOrganizerDto) {

  }
}
