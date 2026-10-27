import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Prisma } from '../src/generated/prisma/client.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { categories } from '../prisma/seed-data.js';

if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL is required for database tests');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }),
});
const rollback = new Error('rollback test fixtures');

async function fixtures(tx: Prisma.TransactionClient) {
  const organizer = await tx.user.create({
    data: {
      firstName: 'Test',
      lastName: 'Organizer',
      email: `${randomUUID()}@example.invalid`,
      passwordHash: 'non-login-test-fixture',
      role: 'ORGANIZER',
      status: 'ACTIVE',
    },
  });
  const student = await tx.user.create({
    data: {
      firstName: 'Test',
      lastName: 'Student',
      email: `${randomUUID()}@example.invalid`,
      passwordHash: 'non-login-test-fixture',
      role: 'STUDENT',
      status: 'ACTIVE',
      studentProfile: { create: { university: 'Test University' } },
    },
  });
  const organization = await tx.organization.create({
    data: {
      ownerId: organizer.id,
      orgName: 'Test Club',
      type: 'STUDENT_CLUB',
      representativeFullName: 'Test Organizer',
      academicPosition: 'Student',
      phoneNumber: '+212000000000',
      verificationStatus: 'PENDING',
    },
  });
  const event = await tx.event.create({
    data: {
      organizationId: organization.id,
      createdById: organizer.id,
      title: 'Test Event',
      description: 'Integration test fixture',
      format: 'ONLINE',
      startDate: new Date('2030-01-01T10:00:00Z'),
      endDate: new Date('2030-01-01T12:00:00Z'),
      registrationMode: 'AUTOMATIC',
      status: 'DRAFT',
    },
  });
  return { organizer, student, organization, event };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('database foundation', () => {
  it('seeds without HTTP configuration and preserves records on repeated runs', async () => {
    const before = await prisma.category.findMany({ orderBy: { slug: 'asc' } });
    for (let run = 0; run < 2; run++) {
      execFileSync(
        process.execPath,
        ['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts'],
        {
          env: {
            ...process.env,
            NODE_ENV: run === 0 ? 'production' : 'test',
            CORS_ORIGINS: '',
            PORT: 'not-an-api-port',
            DATABASE_URL: process.env.TEST_DATABASE_URL,
          },
          stdio: 'pipe',
        },
      );
    }
    expect(
      await prisma.category.findMany({ orderBy: { slug: 'asc' } }),
    ).toEqual(before);
  });

  it('has the seeded category catalog', async () => {
    const records = await prisma.category.findMany({
      where: { slug: { in: categories.map((c) => c.slug) } },
    });
    expect(records).toHaveLength(categories.length);
    expect(new Set(records.map((c) => c.slug)).size).toBe(categories.length);
  });

  it('connects all domain models and permits users without student profiles', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const { organizer, student, organization, event } = await fixtures(tx);
        expect(
          await tx.studentProfile.findUnique({
            where: { userId: organizer.id },
          }),
        ).toBeNull();
        expect(
          await tx.studentProfile.findUnique({ where: { userId: student.id } }),
        ).not.toBeNull();
        const category = await tx.category.findUniqueOrThrow({
          where: { slug: 'hackathons' },
        });
        await tx.organizationApplication.create({
          data: {
            organizationId: organization.id,
            submittedById: organizer.id,
            status: 'PENDING',
          },
        });
        await tx.eventCategory.create({
          data: { eventId: event.id, categoryId: category.id },
        });
        await tx.studentInterest.create({
          data: { studentId: student.id, categoryId: category.id },
        });
        await tx.organizationFollow.create({
          data: { followerId: student.id, organizationId: organization.id },
        });
        await tx.eventRegistration.create({
          data: {
            eventId: event.id,
            studentId: student.id,
            status: 'CONFIRMED',
          },
        });
        await tx.notification.create({
          data: {
            userId: student.id,
            eventId: event.id,
            organizationId: organization.id,
            type: 'REGISTRATION_CONFIRMED',
            title: 'Confirmed',
            message: 'Test notification',
            isRead: false,
          },
        });
        const result = await tx.event.findUniqueOrThrow({
          where: { id: event.id },
          include: {
            categories: true,
            registrations: true,
            notifications: true,
          },
        });
        expect(result.categories).toHaveLength(1);
        expect(result.registrations).toHaveLength(1);
        expect(result.notifications).toHaveLength(1);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });

  it('rejects duplicate registrations', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const { student, event } = await fixtures(tx);
        const data = {
          eventId: event.id,
          studentId: student.id,
          status: 'CONFIRMED' as const,
        };
        await tx.eventRegistration.create({ data });
        await tx.eventRegistration.create({ data });
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('defaults profile interests to an empty array and persists multiple interests', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const { student } = await fixtures(tx);
        const profile = await tx.studentProfile.findUniqueOrThrow({
          where: { userId: student.id },
        });
        expect(profile.interests).toEqual([]);
        await tx.studentProfile.update({
          where: { userId: student.id },
          data: { interests: ['HACKATHONS', 'AI_DATA'] },
        });
        const updated = await tx.studentProfile.findUniqueOrThrow({
          where: { userId: student.id },
        });
        expect(updated.interests).toEqual(['HACKATHONS', 'AI_DATA']);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });

  it('rejects profiles without a user', async () => {
    await expect(
      prisma.studentProfile.create({ data: { userId: randomUUID() } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('preserves referenced users until their dependents are handled explicitly', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const { student } = await fixtures(tx);
        await tx.user.delete({ where: { id: student.id } });
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});
