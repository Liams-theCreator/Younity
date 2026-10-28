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

  private isEmailConflict(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    // Recognize the usual field/constraint metadata.
    const target = error.meta?.target;

    if (
      (Array.isArray(target) &&
        target.length === 1 &&
        target[0] === 'email') ||
      target === 'email' ||
      target === 'users_email_key'
    ) {
      return true;
    }

    // Recognize the adapter metadata captured in your report.
    const adapterError = error.meta?.driverAdapterError;

    if (
      typeof adapterError !== 'object' ||
      adapterError === null ||
      !('cause' in adapterError)
    ) {
      return false;
    }

    const cause = adapterError.cause;

    if (
      typeof cause !== 'object' ||
      cause === null ||
      !('constraint' in cause)
    ) {
      return false;
    }

    const constraint = cause.constraint;

    return (
      error.meta?.modelName === 'User' &&
      typeof constraint === 'object' &&
      constraint !== null &&
      'index' in constraint &&
      constraint.index === 'users_email_key'
    );
  }

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
      return await this.prisma.user.create({
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
      if (this.isEmailConflict(error)) {
        throw new ConflictException('Email is already registered');
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
      return await this.prisma.user.create({
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
      if (this.isEmailConflict(error)) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }
}
