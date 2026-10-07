import { ConflictException, Injectable } from "@nestjs/common";
import * as argon2 from 'argon2';
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
    const passwordhash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordhash,
        role: Role.STUDENT,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async registerOrganizer(dto: RegisterOrganizerDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      }
    })
    if (existingUser) {
      throw new ConflictException('Email si already registred');
    }
    const passwordhash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordhash,
        role: Role.ORGANIZER,
        organizationName: dto.organizationName,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });
  }
}
