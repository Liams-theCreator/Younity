import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  Prisma,
  UserRole,
  UserStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdatePreferencesDto } from './update-preferences.dto.js';

@Injectable()
export class StudentPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const profile = await this.prisma.studentProfile.findFirst({
      where: {
        userId,
        user: {
          is: {
            role: UserRole.STUDENT,
            status: UserStatus.ACTIVE,
            emailVerifiedAt: { not: null },
          },
        },
      },
      select: {
        interests: true,
        university: true,
        academicField: true,
        studyLevel: true,
        opportunityFormat: true,
      },
    });

    if (!profile) {
      throw new ForbiddenException(
        'An active student account with a verified email and student profile is required',
      );
    }

    return profile;
  }

  async update(userId: string, dto: UpdatePreferencesDto) {
    try {
      return await this.prisma.studentProfile.update({
        where: {
          userId,
          user: {
            is: {
              role: UserRole.STUDENT,
              status: UserStatus.ACTIVE,
              emailVerifiedAt: { not: null },
            },
          },
        },
        data: {
          interests: dto.interests,
          ...(dto.university !== undefined
            ? { university: dto.university }
            : {}),
          ...(dto.academicField !== undefined
            ? { academicField: dto.academicField }
            : {}),
          ...(dto.studyLevel !== undefined
            ? { studyLevel: dto.studyLevel }
            : {}),
          ...(dto.opportunityFormat !== undefined
            ? { opportunityFormat: dto.opportunityFormat }
            : {}),
        },
        select: {
          interests: true,
          university: true,
          academicField: true,
          studyLevel: true,
          opportunityFormat: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ForbiddenException(
          'An active student account with a verified email and student profile is required',
        );
      }

      throw error;
    }
  }
}