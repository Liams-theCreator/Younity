import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { RegistrationService } from '../src/auth/registration/registration.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { OrganizationType } from '../src/generated/prisma/enums.js';

describe('Registration database integration', () => {
  let module: TestingModule | undefined;
  let prisma: PrismaService | undefined;
  let service: RegistrationService;

  const testEmails: string[] = [];
  const previousDatabaseUrl = process.env.DATABASE_URL;

  function getDatabase(): PrismaService {
    if (!prisma) {
      throw new Error('Test database is not initialized');
    }

    return prisma;
  }

  function newEmail() {
    const email = `registration-${randomUUID()}@example.com`;
    testEmails.push(email);
    return email;
  }

  function studentInput(email: string) {
    return {
      firstName: 'Sara',
      lastName: 'Test',
      email,
      password: 'Example-password-2026!',
    };
  }

  function organizerInput(email: string) {
    return {
      ...studentInput(email),
      organizationName: 'Test Club',
      type: OrganizationType.STUDENT_CLUB,
      representativeFullName: 'Sara Test',
      academicPosition: 'Club President',
      phoneNumber: '+212612345678',
    };
  }

  beforeAll(async () => {
    const testUrl = process.env.TEST_DATABASE_URL;

    if (!testUrl) {
      throw new Error('TEST_DATABASE_URL is required');
    }

    const databaseName = decodeURIComponent(
      new URL(testUrl).pathname.slice(1),
    );

    if (!databaseName.endsWith('_test')) {
      throw new Error('Use a dedicated database ending in _test');
    }

    process.env.DATABASE_URL = testUrl;

    module = await Test.createTestingModule({
      providers: [RegistrationService, PrismaService],
    }).compile();

    prisma = module.get(PrismaService);
    service = module.get(RegistrationService);

    await module.init();
  }, 30_000);

  afterEach(async () => {
    vi.restoreAllMocks();

    if (!prisma || testEmails.length === 0) return;

    const users = await prisma.user.findMany({
      where: { email: { in: testEmails } },
      select: { id: true },
    });

    const ids = users.map(user => user.id);

    // Remove only records belonging to this suite.
    await prisma.organization.deleteMany({
      where: { ownerId: { in: ids } },
    });

    await prisma.studentProfile.deleteMany({
      where: { userId: { in: ids } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });

    testEmails.length = 0;
  });

  afterAll(async () => {
    try {
      await module?.close();
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });

  it.each(['student', 'organizer'] as const)(
    'creates one account when two %s registrations compete',
    async role => {
      const db = getDatabase();
      const email = newEmail();

      expect(
        await db.user.findUnique({ where: { email } }),
      ).toBeNull();

      // Force both preliminary checks to report "available".
      // The writes and PostgreSQL constraints remain real.
      const lookup = vi
        .spyOn(db.user, 'findUnique')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const register = () =>
        role === 'student'
          ? service.registerStudent(studentInput(email))
          : service.registerOrganizer(organizerInput(email));

      const results = await Promise.allSettled([
        register(),
        register(),
      ]);

      expect(lookup).toHaveBeenCalledTimes(2);
      lookup.mockRestore();

      const successes = results.filter(
        result => result.status === 'fulfilled',
      );

      const failures = results.filter(
        result => result.status === 'rejected',
      );

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);

      const failure = failures[0];

      if (!failure || failure.status !== 'rejected') {
        throw new Error('Expected one failed registration');
      }

      expect(failure.reason).toBeInstanceOf(ConflictException);

      const success = successes[0];

      if (!success || success.status !== 'fulfilled') {
        throw new Error('Expected one successful registration');
      }

      expect(success.value).not.toHaveProperty('passwordHash');

      const users = await db.user.findMany({
        where: { email },
      });

      expect(users).toHaveLength(1);

      const userId = users[0]!.id;

      expect(
        await db.studentProfile.count({
          where: { userId },
        }),
      ).toBe(role === 'student' ? 1 : 0);

      expect(
        await db.organization.count({
          where: { ownerId: userId },
        }),
      ).toBe(role === 'organizer' ? 1 : 0);
    },
    20_000,
  );

  it('does not leave a user when the profile insert fails', async () => {
    const db = getDatabase();
    const email = newEmail();

    // Requires university to be VARCHAR(255) in the real database.
    const input = {
      ...studentInput(email),
      university: 'x'.repeat(256),
    };

    await expect(
      service.registerStudent(input),
    ).rejects.toMatchObject({
      code: 'P2000',
    });

    expect(
      await db.user.findUnique({ where: { email } }),
    ).toBeNull();
  }, 20_000);
});
