import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../../generated/prisma/client.js';

import { RegistrationService } from './registration.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RegisterStudentDto } from '../dto/register-student.dto.js';

describe('RegistrationService: student registration', () => {
  let service: RegistrationService;

  // Fake database methods: these never connect to PostgreSQL.
  const prismaMock = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };

  // This assumes profile fields are optional in your updated DTO.
  const dto: RegisterStudentDto = {
    firstName: 'Abdellah',
    lastName: 'Test',
    email: 'student@example.com',
    password: 'TestPassword123!',
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

  it('rejects an email that already exists', async () => {
    // Arrange: pretend this email already belongs to a user.
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'existing-user-id',
      email: dto.email,
    });

    // Act + Assert: registration must reject the request.
    await expect(
      service.registerStudent(dto),
    ).rejects.toBeInstanceOf(ConflictException);

    // It must not attempt to create another user.
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('hashes the password before passing it to Prisma', async () => {
    // Arrange: pretend the email is available.
    prismaMock.user.findUnique.mockResolvedValue(null);

    prismaMock.user.create.mockResolvedValue({
      id: 'created-user-id',
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
    });

    // Act: execute your real registration service.
    await service.registerStudent(dto);

    // Assert: inspect what your service passed to Prisma.
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);

    const createArguments =
      prismaMock.user.create.mock.calls[0]![0];

    const storedHash = createArguments.data.passwordHash;

    expect(createArguments.data.email).toBe(dto.email);
    expect(storedHash).not.toBe(dto.password);

    // Prove the hash corresponds to the submitted password.
    expect(
      await argon2.verify(storedHash, dto.password),
    ).toBe(true);

    expect(
      await argon2.verify(storedHash, 'wrong-password'),
    ).toBe(false);
  });
});


