import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/config/application.js';
import { validateEnvironment } from '../src/config/environment.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  UserRole,
  UserStatus,
} from '../src/generated/prisma/enums.js';

describe('Student preferences API with real JWT cookies and PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  const ids: string[] = [];

  let studentId: string;
  let otherId: string;
  let cookie: string;

  const valid = {
    interests: ['AI_DATA', 'ROBOTICS_IOT'],
  };

  async function createUser(
    options: {
      role?: UserRole;
      status?: UserStatus;
      verified?: boolean;
      profile?: boolean;
    } = {},
  ) {
    const user = await prisma.user.create({
      data: {
        firstName: 'Preferences',
        lastName: 'Test',
        email: `preferences-${randomUUID()}@example.test`,
        passwordHash: 'not-used-for-login-in-this-test',
        role: options.role ?? UserRole.STUDENT,
        status: options.status ?? UserStatus.ACTIVE,
        emailVerifiedAt:
          options.verified === false ? null : new Date(),
        ...(options.profile === false
          ? {}
          : {
              studentProfile: {
                create: {
                  university: 'Saved university',
                  interests: ['HACKATHONS'],
                },
              },
            }),
      },
    });

    ids.push(user.id);

    return user.id;
  }

  async function session(id: string) {
    return `access_token=${await jwt.signAsync({ sub: id })}`;
  }

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;

    if (
      !url ||
      !decodeURIComponent(new URL(url).pathname).endsWith('_test')
    ) {
      throw new Error(
        'Use an explicit isolated TEST_DATABASE_URL ending in _test',
      );
    }

    process.env.DATABASE_URL = url;

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());

    configureApplication(app, validateEnvironment());

    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    studentId = await createUser();
    otherId = await createUser();
    cookie = await session(studentId);
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.studentProfile.deleteMany({
          where: {
            userId: { in: ids },
          },
        });

        await prisma.user.deleteMany({
          where: {
            id: { in: ids },
          },
        });
      }
    } finally {
      if (app) await app.close();
    }
  });

  it('persists preferences only for the authenticated student and omits private fields', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/student/preferences')
      .set('Cookie', cookie)
      .send(valid)
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');

    expect(response.body).toEqual({
      ...valid,
      university: 'Saved university',
      academicField: null,
      studyLevel: null,
      opportunityFormat: null,
    });

    const saved = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: studentId },
    });

    expect(saved.interests).toEqual(valid.interests);

    const other = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: otherId },
    });

    expect(other.interests).toEqual(['HACKATHONS']);
  });

  it.each([
    {},
    { interests: [] },
    { interests: ['AI_DATA'] },
    { interests: ['AI_DATA', 'AI_DATA'] },
    { interests: ['AI_DATA', 'UNKNOWN'] },
    { interests: null },
    { interests: 'AI_DATA' },
    { ...valid, userId: 'another-user' },
    { ...valid, role: 'ADMIN' },
    { ...valid, onboardingComplete: true },
    { ...valid, academicField: 'UNKNOWN' },
    { ...valid, university: '' },
  ])(
    'rejects invalid or injected data without changing saved interests: %j',
    async (body) => {
      const before = await prisma.studentProfile.findUniqueOrThrow({
        where: { userId: studentId },
      });

      await request(app.getHttpServer())
        .patch('/api/student/preferences')
        .set('Cookie', cookie)
        .send(body)
        .expect(400);

      const after = await prisma.studentProfile.findUniqueOrThrow({
        where: { userId: studentId },
      });

      expect(after).toEqual(before);

      const other = await prisma.studentProfile.findUniqueOrThrow({
        where: { userId: otherId },
      });

      expect(other.interests).toEqual(['HACKATHONS']);
    },
  );

  it('preserves omitted academic values and clears explicitly nullable values', async () => {
    await request(app.getHttpServer())
      .patch('/api/student/preferences')
      .set('Cookie', cookie)
      .send({
        ...valid,
        university: '  New university  ',
        studyLevel: 'MASTER',
        academicField: 'COMPUTER_SCIENCE',
        opportunityFormat: 'HYBRID',
      })
      .expect(200);

    const preserved = await request(app.getHttpServer())
      .patch('/api/student/preferences')
      .set('Cookie', cookie)
      .send(valid)
      .expect(200);

    expect(preserved.body.university).toBe('New university');
    expect(preserved.body.studyLevel).toBe('MASTER');

    const cleared = await request(app.getHttpServer())
      .patch('/api/student/preferences')
      .set('Cookie', cookie)
      .send({
        ...valid,
        university: null,
        studyLevel: null,
        academicField: null,
        opportunityFormat: null,
      })
      .expect(200);

    expect(cleared.body).toEqual({
      ...valid,
      university: null,
      studyLevel: null,
      academicField: null,
      opportunityFormat: null,
    });
  });

  it('rejects missing, invalid and expired sessions', async () => {
    const expiredToken = await jwt.signAsync(
      { sub: studentId },
      { expiresIn: -5 },
    );

    for (const value of [
      '',
      'access_token=invalid',
      `access_token=${expiredToken}`,
    ]) {
      await request(app.getHttpServer())
        .patch('/api/student/preferences')
        .set('Cookie', value)
        .send(valid)
        .expect(401);
    }
  });

  it.each([
    { role: UserRole.ORGANIZER },
    { role: UserRole.ADMIN },
    { verified: false },
    { status: UserStatus.SUSPENDED },
    { status: UserStatus.PENDING },
    { profile: false },
  ])('rejects ineligible accounts: %j', async (options) => {
    const id = await createUser(options);

    await request(app.getHttpServer())
      .patch('/api/student/preferences')
      .set('Cookie', await session(id))
      .send(valid)
      .expect(403);
  });

  it('rechecks verification after an existing cookie was issued', async () => {
    const id = await createUser();
    const issuedCookie = await session(id);

    await prisma.user.update({
      where: { id },
      data: { emailVerifiedAt: null },
    });

    await request(app.getHttpServer())
      .patch('/api/student/preferences')
      .set('Cookie', issuedCookie)
      .send(valid)
      .expect(403);
  });

  it('documents the cookie-protected PATCH contract in Swagger', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(
      response.body.paths['/api/student/preferences'].patch.security,
    ).toEqual([{ cookie: [] }]);

    expect(
      response.body.components.securitySchemes.cookie.name,
    ).toBe('access_token');
  });
});