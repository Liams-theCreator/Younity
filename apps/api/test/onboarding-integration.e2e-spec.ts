import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureApplication } from '../src/config/application.js';
import { validateEnvironment } from '../src/config/environment.js';

describe('Onboarding: real database, cookies and admin transitions', () => {
  let app: INestApplication;
  let db: PrismaService;
  let jwt: JwtService;
  const ids: string[] = [];

  async function account(role: 'STUDENT' | 'ORGANIZER' | 'ADMIN') {
    const user = await db.user.create({
      data: {
        firstName: 'Onboarding',
        lastName: 'Test',
        email: `${randomUUID()}@example.test`,
        passwordHash: 'not-a-login-hash',
        role,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });

    ids.push(user.id);

    return {
      id: user.id,
      cookie: `access_token=${await jwt.signAsync({ sub: user.id })}`,
    };
  }

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;

    if (
      !url ||
      !decodeURIComponent(new URL(url).pathname).endsWith('_test')
    ) {
      throw new Error('Isolated test database required');
    }

    process.env.DATABASE_URL = url;

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    configureApplication(app, validateEnvironment());
    await app.init();

    db = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    if (db) {
      const application = { submittedById: { in: ids } };

      await db.decisionEmail.deleteMany({
        where: { decision: { application } },
      });
      await db.applicationDecision.deleteMany({
        where: { application },
      });
      await db.notification.deleteMany({
        where: { userId: { in: ids } },
      });
      await db.organizationApplication.deleteMany({
        where: application,
      });
      await db.organization.deleteMany({
        where: { ownerId: { in: ids } },
      });
      await db.studentProfile.deleteMany({
        where: { userId: { in: ids } },
      });
      await db.user.deleteMany({
        where: { id: { in: ids } },
      });
    }

    await app?.close();
  });

  it('requires two saved distinct interests, ignores optional academics, and never acknowledges as a student', async () => {
    const student = await account('STUDENT');

    await db.studentProfile.create({
      data: { userId: student.id },
    });

    const http = app.getHttpServer();

    expect(
      (
        await request(http)
          .get('/api/auth/me')
          .set('Cookie', student.cookie)
          .expect(200)
      ).body.onboarding,
    ).toEqual({
      complete: false,
      nextStep: 'SELECT_INTERESTS',
    });

    await request(http)
      .patch('/api/student/preferences')
      .set('Cookie', student.cookie)
      .send({ interests: ['AI_DATA', 'AI_DATA'] })
      .expect(400);

    await request(http)
      .patch('/api/student/preferences')
      .set('Cookie', student.cookie)
      .send({ interests: ['AI_DATA', 'ROBOTICS_IOT'] })
      .expect(200);

    expect(
      (
        await request(http)
          .get('/api/auth/me')
          .set('Cookie', student.cookie)
      ).body.onboarding,
    ).toEqual({
      complete: true,
      nextStep: 'NONE',
    });

    await request(http)
      .post('/api/auth/acknowledge-approval')
      .set('Cookie', student.cookie)
      .expect(403);

    await request(http)
      .post('/api/auth/acknowledge-approval')
      .expect(401);
  });

  it('restores, clears, submits, corrects, resubmits the same application, approves, and persists one-time acknowledgment', async () => {
    const owner = await account('ORGANIZER');
    const admin = await account('ADMIN');

    const org = await db.organization.create({
      data: {
        ownerId: owner.id,
        orgName: 'Registration',
        type: 'STUDENT_CLUB',
        representativeFullName: 'Sara Test',
        academicPosition: 'Coordinator',
        phoneNumber: '+212612345678',
        verificationStatus: 'PENDING',
      },
    });

    const http = app.getHttpServer();

    const me = () =>
      request(http)
        .get('/api/auth/me')
        .set('Cookie', owner.cookie)
        .expect(200);

    const draft = () =>
      request(http)
        .get('/api/organizer-applications/draft')
        .set('Cookie', owner.cookie);

    const save = (body: object) =>
      request(http)
        .patch('/api/organizer-applications/draft')
        .set('Cookie', owner.cookie)
        .send(body);

    const submit = () =>
      request(http)
        .post('/api/organizer-applications/submit')
        .set('Cookie', owner.cookie);

    const decision = (
      id: string,
      action: string,
      revision: number,
    ) =>
      request(http)
        .post(`/api/admin/applications/${id}/${action}`)
        .set('Cookie', admin.cookie)
        .send({
          reason: 'Please update the contact information',
          expectedRevision: revision,
        });

    expect((await me()).body.onboarding.complete).toBe(false);

    expect((await draft().expect(200)).body).toEqual({
      draft: null,
      canEdit: true,
    });

    await save({
      organizationName: 'Campus Club',
      proofUrl: 'https://example.test/info',
    }).expect(200);

    await save({ proofUrl: null }).expect(200);
    expect((await draft()).body.draft.proofUrl).toBeNull();

    await submit().expect(400);

    await save({
      type: 'STUDENT_CLUB',
      representativeFullName: 'Sara Test',
      academicPosition: 'Coordinator',
      phoneNumber: '+212612345678',
    }).expect(200);

    const id = (await submit().expect(201)).body.application.id as string;

    expect((await me()).body.onboarding).toEqual({
      complete: true,
      nextStep: 'NONE',
    });

    expect((await draft()).body.canEdit).toBe(false);

    await save({ organizationName: 'Blocked' }).expect(409);
    await submit().expect(409);

    expect(
      await db.organizationApplication.count({
        where: { organizationId: org.id },
      }),
    ).toBe(1);

    await decision(id, 'request-changes', 1).expect(201);

    const correction = (await me()).body;

    expect(correction.onboarding.complete).toBe(true);
    expect(correction.organization.verificationStatus).toBe('NEEDS_CHANGES');
    expect(correction.organization.application.reviewerNote).toContain('contact');

    await save({ phoneNumber: '+212612345679' }).expect(200);

    expect((await submit().expect(201)).body.application).toEqual({
      id,
      status: 'PENDING',
    });

    expect((await me()).body.organization.verificationStatus).toBe('PENDING');

    await request(http)
      .post('/api/auth/acknowledge-approval')
      .set('Cookie', owner.cookie)
      .expect(403);

    await decision(id, 'approve', 2).expect(201);

    expect((await me()).body.organization.approvalAcknowledged).toBe(false);

    await request(http)
      .post('/api/auth/acknowledge-approval')
      .set('Cookie', owner.cookie)
      .expect(204);

    const timestamp = (
      await db.organization.findUniqueOrThrow({
        where: { id: org.id },
      })
    ).approvalAcknowledgedAt;

    await request(http)
      .post('/api/auth/acknowledge-approval')
      .set('Cookie', owner.cookie)
      .expect(204);

    expect(
      (
        await db.organization.findUniqueOrThrow({
          where: { id: org.id },
        })
      ).approvalAcknowledgedAt,
    ).toEqual(timestamp);

    const newCookie =
      `access_token=${await jwt.signAsync({ sub: owner.id })}`;

    expect(
      (
        await request(http)
          .get('/api/auth/me')
          .set('Cookie', newCookie)
      ).body.organization.approvalAcknowledged,
    ).toBe(true);

    await db.user.update({
      where: { id: owner.id },
      data: { status: 'SUSPENDED' },
    });

    await request(http)
      .post('/api/auth/acknowledge-approval')
      .set('Cookie', owner.cookie)
      .expect(403);
  });
});