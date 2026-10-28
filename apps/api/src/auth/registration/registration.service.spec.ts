import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { RegistrationService } from './registration.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  OrganizationType,
  UserRole,
  UserStatus,
  VerificationStatus,
} from '../../generated/prisma/enums.js';

describe('RegistrationService', () => {
  let service: RegistrationService;

  const prismaMock = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  const studentDto = {
    firstName: 'Sara',
    lastName: 'Test',
    email: 'student@example.com',
    password: 'Example-password-2026!',
  };

  const organizerDto = {
    ...studentDto,
    email: 'organizer@example.com',
    organizationName: 'Test Club',
    type: OrganizationType.STUDENT_CLUB,
    representativeFullName: 'Sara Test',
    academicPosition: 'Club President',
    phoneNumber: '+212612345678',
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        RegistrationService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get(RegistrationService);
  });

  for (const role of ['student', 'organizer'] as const) {
    describe(role, () => {
      const dto = role === 'student' ? studentDto : organizerDto;

      const register = () =>
        role === 'student'
          ? service.registerStudent(studentDto)
          : service.registerOrganizer(organizerDto);

      it('rejects an existing email before creating anything', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
          id: 'existing-user',
          email: dto.email,
        });

        await expect(register()).rejects.toBeInstanceOf(
          ConflictException,
        );

        expect(prismaMock.user.create).not.toHaveBeenCalled();
      });

      it('hashes the password and sends the correct role/profile data', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue({
          id: 'created-user',
          email: dto.email,
        });

        await register();

        expect(prismaMock.user.create).toHaveBeenCalledTimes(1);

        const argumentsPassed =
          prismaMock.user.create.mock.calls[0]![0];

        const data = argumentsPassed.data;

        expect(data.email).toBe(dto.email);
        expect(data.passwordHash).not.toBe(dto.password);

        expect(
          await argon2.verify(data.passwordHash, dto.password),
        ).toBe(true);

        expect(
          await argon2.verify(data.passwordHash, 'wrong-password'),
        ).toBe(false);

        if (role === 'student') {
          expect(data.role).toBe(UserRole.STUDENT);
          expect(data.status).toBe(UserStatus.ACTIVE);
          expect(data.studentProfile.create.interests).toEqual([]);
        } else {
          expect(data.role).toBe(UserRole.ORGANIZER);
          expect(data.status).toBe(UserStatus.PENDING);
          expect(
            data.ownedOrganizations.create.verificationStatus,
          ).toBe(VerificationStatus.PENDING);
        }

        // Check the requested database projection.
        // This alone does not prove the real HTTP response is safe.
        expect(argumentsPassed.select.passwordHash).not.toBe(true);
      });

      it('converts an insert-time email conflict into ConflictException', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const error = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          {
            code: 'P2002',
            clientVersion: '7.10.0',
            meta: {
              modelName: 'User',
              driverAdapterError: {
                cause: {
                  constraint: { index: 'users_email_key' },
                },
              },
            },
          },
        );

        prismaMock.user.create.mockRejectedValue(error);

        await expect(register()).rejects.toBeInstanceOf(
          ConflictException,
        );
      });

      it('preserves unrelated uniqueness errors', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const error = new Prisma.PrismaClientKnownRequestError(
          'Another unique constraint failed',
          {
            code: 'P2002',
            clientVersion: '7.10.0',
            meta: { target: ['id'] },
          },
        );

        prismaMock.user.create.mockRejectedValue(error);

        await expect(register()).rejects.toBe(error);
      });

      it('preserves unexpected insertion errors', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const error = new Error('Database connection lost');
        prismaMock.user.create.mockRejectedValue(error);

        await expect(register()).rejects.toBe(error);
      });

      it('does not create a user when the email lookup fails', async () => {
        const error = new Error('Database unavailable');
        prismaMock.user.findUnique.mockRejectedValue(error);

        await expect(register()).rejects.toBe(error);

        expect(prismaMock.user.create).not.toHaveBeenCalled();
      });
    });
  }
});
