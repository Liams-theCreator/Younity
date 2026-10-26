import { ConflictException, Injectable } from "@nestjs/common";
import * as argon2 from 'argon2';
import { Prisma } from "../../generated/prisma/client.js";
import { RegisterOrganizerDto } from "../dto/register-organizer.dto.js";
import { RegisterStudentDto } from "../dto/register-student.dto.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { UserRole, UserStatus, VerificationStatus } from "../../generated/prisma/enums.js";

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

    try {
      return this.prisma.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          passwordHash,
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,

          studentProfile: {
            create: {
              university: dto.university,
              studyLevel: dto.studyLevel,
              academicField: dto.academicField,
              interests: dto.interests ?? [],
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

          studentProfile: {
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target;

        const isEmailConflict =
          (Array.isArray(target) &&
            target.length === 1 &&
            target[0] === 'email') ||
          target === 'email' ||
          target === 'users_email_key';

        if (isEmailConflict) {
          throw new ConflictException('Email is already registered');
        }
      }
      throw error;
    }
  }

  async registerOrganizer(dto: RegisterOrganizerDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      }
    })
    if (existingUser) {
      throw new ConflictException('Email is already registred');
    }
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    try {
      return this.prisma.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          passwordHash,
          role: UserRole.ORGANIZER,
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target;

        const isEmailConflict =
          (Array.isArray(target) &&
            target.length === 1 &&
            target[0] === 'email') ||
          target === 'email' ||
          target === 'users_email_key';

        if (isEmailConflict) {
          throw new ConflictException('Email is already registered');
        }
      }
      throw error;
    }
  }
}
