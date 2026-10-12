import { ConflictException, Injectable } from "@nestjs/common";
import * as argon2 from 'argon2';
import { RegisterOrganizerDto } from "../dto/register-organizer.dto.js";
import { RegisterStudentDto } from "../dto/register-student.dto.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { Role, UserStatus, VerificationStatus } from "../../generated/prisma/enums.js";

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
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    return this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
        role: Role.STUDENT,
        status: UserStatus.APPROVED,

        student: {
          create: {
            university: dto.university,
            studyLevel: dto.studyLevel,
            academicField: dto.academicField,
            interests: dto.interests,
            opportunityFormat: dto.opportunityFormat,
          },
        },
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,

        student: {
          select: {
            university: true,
            studyLevel: true,
            academicField: true,
            interests: true,
            opportunityFormat: true,
          },
        },
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
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    return this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
        role: Role.ORGANIZER,
        status: UserStatus.PENDING,

        ownedOrganizations: {
          create: {
            orgName: dto.organizationName,
            type: dto.type,
            representativeFullName: dto.representativeFullName,
            academicPosition: dto.academicPosition,
            proofUrl: dto.proofUrl,
            phoneNumber: dto.phoneNumber,
            verificationStatus: VerificationStatus.PENDING,
          },
        },
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,

        ownedOrganizations: {
          select: {
            id: true,
            orgName: true,
            type: true,
            representativeFullName: true,
            academicPosition: true,
            phoneNumber: true,
            verificationStatus: true,
            createdAt: true,
          },
        },
      },
    });
  }
}
