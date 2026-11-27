import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateStudentNameDto } from './update-student-name.dto.js';

const eligibleStudent = {
  role: UserRole.STUDENT,
  status: UserStatus.ACTIVE,
  emailVerifiedAt: { not: null },
  studentProfile: { isNot: null },
} satisfies Prisma.UserWhereInput;

const names = { firstName: true, lastName: true } as const;
const ineligibleMessage = 'An active, email-verified student account is required';

@Injectable()
export class StudentProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getName(id: string) {
    const student = await this.prisma.user.findUnique({
      where: { id, ...eligibleStudent },
      select: names,
    });

    if (!student) throw new ForbiddenException(ineligibleMessage);
    return student;
  }

  async updateName(id: string, { firstName, lastName }: UpdateStudentNameDto) {
    if (firstName === undefined && lastName === undefined) {
      throw new BadRequestException('Provide a first name or last name');
    }

    try {
      return await this.prisma.user.update({
        where: { id, ...eligibleStudent },
        data: {
          ...(firstName === undefined ? {} : { firstName }),
          ...(lastName === undefined ? {} : { lastName }),
        },
        select: names,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ForbiddenException(ineligibleMessage);
      }

      throw error;
    }
  }
}
