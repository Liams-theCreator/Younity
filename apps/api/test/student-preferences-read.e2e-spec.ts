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
import { UserRole, UserStatus } from '../src/generated/prisma/enums.js';

describe('Student profile and saved preferences using PostgreSQL and JWT cookies', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const ids: string[] = [];

  async function createUser(options: {
    role?: UserRole;
    status?: UserStatus;
    verified?: boolean;
    profile?: boolean;
  } = {}) {
    const user = await prisma.user.create({
      data: {
        firstName: 'Read',
        lastName: 'Preferences',
        email: `preferences-read-${randomUUID()}@example.test`,
        passwordHash: 'unused-test-fixture-password-hash',
        role: options.role ?? UserRole.STUDENT,
        status: options.status ?? UserStatus.ACTIVE,
        emailVerifiedAt:
          options.verified === false ? null : new Date(),
        ...(options.profile === false
          ? {}
          : {
              studentProfile: {
                create: {
                  interests: ['AI_DATA'],
                  university: 'Saved institution',
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
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.studentProfile.deleteMany({
          where: { userId: { in: ids } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: ids } },
        });
      }
    } finally {
      if (app) await app.close();
    }
  });

  it('reads incomplete saved preferences without modifying them or exposing private fields', async () => {
    const id = await createUser();
    const before = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: id },
    });

    const response = await request(app.getHttpServer())
      .get('/api/student/preferences')
      .set('Cookie', await session(id))
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      interests: ['AI_DATA'],
      university: 'Saved institution',
      academicField: null,
      studyLevel: null,
      opportunityFormat: null,
    });

    expect(
      await prisma.studentProfile.findUniqueOrThrow({
        where: { userId: id },
      }),
    ).toEqual(before);
  });

  it('uses the cookie owner rather than a supplied query-string identity', async () => {
    const owner = await createUser();
    const other = await createUser();

    await prisma.studentProfile.update({
      where: { userId: other },
      data: {
        interests: ['HACKATHONS'],
        university: 'Other institution',
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/student/preferences?userId=${other}`)
      .set('Cookie', await session(owner))
      .expect(200);

    expect(response.body.university).toBe('Saved institution');
    expect(response.body.interests).toEqual(['AI_DATA']);
  });

  it('rejects anonymous, invalid, and expired cookies', async () => {
    const id = await createUser();
    const expired = await jwt.signAsync(
      { sub: id },
      { expiresIn: -5 },
    );

    for (const cookie of [
      '',
      'access_token=invalid',
      `access_token=${expired}`,
    ]) {
      await request(app.getHttpServer())
        .get('/api/student/preferences')
        .set('Cookie', cookie)
        .expect(401);
    }
  });

  it.each([
    { role: UserRole.ORGANIZER },
    { role: UserRole.ADMIN },
    { verified: false },
    { status: UserStatus.PENDING },
    { status: UserStatus.SUSPENDED },
    { profile: false },
  ])('rejects ineligible readers: %j', async (options) => {
    const id = await createUser(options);

    await request(app.getHttpServer())
      .get('/api/student/preferences')
      .set('Cookie', await session(id))
      .expect(403);
  });

  it('rechecks persisted eligibility when verification changes after login', async () => {
    const id = await createUser();
    const cookie = await session(id);

    await prisma.user.update({
      where: { id },
      data: { emailVerifiedAt: null },
    });

    await request(app.getHttpServer())
      .get('/api/student/preferences')
      .set('Cookie', cookie)
      .expect(403);
  });

  it('documents the authenticated GET route', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(
      response.body.paths['/api/student/preferences'].get.security,
    ).toEqual([{ cookie: [] }]);
  });

  it('reads and updates the signed-in student’s name independently of preferences', async () => {
    const id = await createUser();
    const other = await createUser();
    const cookie = await session(id);
    const before = await prisma.studentProfile.findUniqueOrThrow({ where: { userId: id } });
    const initialName = { firstName: 'Read', lastName: 'Preferences' };

    await request(app.getHttpServer())
      .get('/api/student/profile')
      .set('Cookie', cookie)
      .expect('Cache-Control', 'no-store')
      .expect(200, initialName);

    const updatedName = { firstName: 'Lina', lastName: 'Preferences' };
    await request(app.getHttpServer())
      .patch('/api/student/profile')
      .set('Cookie', cookie)
      .send({ firstName: ' Lina ' })
      .expect(200, updatedName);

    const fullName = { ...updatedName, lastName: 'El Idrissi' };
    await request(app.getHttpServer())
      .patch('/api/student/profile')
      .set('Cookie', cookie)
      .send({ lastName: fullName.lastName })
      .expect(200, fullName);

    await request(app.getHttpServer())
      .get('/api/student/profile')
      .set('Cookie', cookie)
      .expect(200, fullName);

    await request(app.getHttpServer())
      .get('/api/student/profile')
      .set('Cookie', await session(other))
      .expect(200, initialName);
    expect(await prisma.studentProfile.findUniqueOrThrow({ where: { userId: id } })).toEqual(before);
  });

  it('rejects invalid names and account fields outside the name contract', async () => {
    const id = await createUser();
    const cookie = await session(id);
    for (const body of [{}, { firstName: null }, { lastName: '  ' }, { firstName: 'Lina1' },
      { lastName: 'a'.repeat(101) }, { firstName: 'Lina', email: 'other@example.test' }]) {
      await request(app.getHttpServer())
        .patch('/api/student/profile')
        .set('Cookie', cookie)
        .send(body)
        .expect(400);
    }
    await request(app.getHttpServer())
      .get('/api/student/profile')
      .set('Cookie', cookie)
      .expect(200, { firstName: 'Read', lastName: 'Preferences' });
  });

  it('requires an eligible student session for name reads and updates', async () => {
    const organizer = await createUser({ role: UserRole.ORGANIZER });
    const cookie = await session(organizer);

    for (const [header, status] of [['', 401], [cookie, 403]] as const) {
      await request(app.getHttpServer())
        .get('/api/student/profile')
        .set('Cookie', header)
        .expect(status);
      await request(app.getHttpServer())
        .patch('/api/student/profile')
        .set('Cookie', header)
        .send({ firstName: 'Lina' })
        .expect(status);
    }
  });
});
