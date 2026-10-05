import { ConflictException, Injectable, Post } from "@nestjs/common";
import { RegisterOrganizerDto } from "../dto/register-organizer.dto.js";
import { RegisterStudentDto } from "../dto/register-student.dto.js";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService) { }

  async registerStudent(dto: RegisterStudentDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      }
    })
    if (existingUser) {
      throw new ConflictException('Email is already registred')
    }
    const passwordhash = await this;
  }

  async registerOrganizer(dto: RegisterOrganizerDto) {
  }
}
