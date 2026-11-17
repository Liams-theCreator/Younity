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
import { AdminService } from '../src/admin/admin.service.js';
import { DecisionEmailDispatcher } from '../src/admin/decision-email.dispatcher.js';
import { MailService } from '../src/auth/mail/mail.service.js';
import { advanceApplicationRevision } from '../src/admin/application-revision.js';
import type { UserRole, UserStatus } from '../src/generated/prisma/enums.js';

describe('Admin decisions: real PostgreSQL and JWT HTTP', () => {
  let app: INestApplication;
  let db: PrismaService;
  let service: AdminService;
  let jwt: JwtService;
  let admin: string;
  let cookie: string;
  const ids: string[] = [];
  async function user(
    role: UserRole = 'ORGANIZER',
    status: UserStatus = 'PENDING',
    verified = true,
  ) {
    const record = await db.user.create({
      data: {
        firstName: 'Admin',
        lastName: 'Test',
        email: `${randomUUID()}@example.invalid`,
        passwordHash: 'not-a-login-hash',
        role,
        status,
        emailVerifiedAt: verified ? new Date() : null,
      },
    });
    ids.push(record.id);
    return record;
  }
  async function fixture(status: UserStatus = 'PENDING') {
    const owner = await user('ORGANIZER', status);
    const submitter = await user('ORGANIZER', 'ACTIVE');
    const org = await db.organization.create({
      data: {
        ownerId: owner.id,
        orgName: 'Test',
        type: 'STUDENT_CLUB',
        representativeFullName: 'Test',
        academicPosition: 'Student',
        phoneNumber: '+212000000000',
        verificationStatus: 'PENDING',
      },
    });
    const application = await db.organizationApplication.create({
      data: {
        organizationId: org.id,
        submittedById: submitter.id,
        status: 'PENDING',
      },
    });
    return { owner, submitter, org, application };
  }
  function post(
    id: string,
    action = 'approve',
    body: object = { reason: ' verified ', expectedRevision: 1 },
    auth = cookie,
  ) {
    const req = request(app.getHttpServer()).post(
      `/api/admin/applications/${id}/${action}`,
    );
    if (auth) req.set('Cookie', auth);
    return req.send(body);
  }
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !new URL(url).pathname.endsWith('_test'))
      throw new Error('Dedicated TEST_DATABASE_URL ending in _test required');
    process.env.DATABASE_URL = url;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    configureApplication(app, validateEnvironment());
    await app.init();
    db = app.get(PrismaService);
    service = app.get(AdminService);
    jwt = app.get(JwtService);
    admin = (await user('ADMIN', 'ACTIVE')).id;
    cookie = `access_token=${await jwt.signAsync({ sub: admin })}`;
  });
  afterAll(async () => {
    if (db) {
      const apps = await db.organizationApplication.findMany({
        where: { submittedById: { in: ids } },
        select: { id: true },
      });
      const filter = { applicationId: { in: apps.map((a) => a.id) } };
      await db.decisionEmail.deleteMany({ where: { decision: filter } });
      await db.applicationDecision.deleteMany({ where: filter });
      await db.organizationApplication.deleteMany({
        where: { id: { in: apps.map((a) => a.id) } },
      });
      await db.organization.deleteMany({ where: { ownerId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });
  it('approves all three entities, actual owner, audit, notification and preserves 201/1', async () => {
    const f = await fixture();
    const res = await post(f.application.id).expect(201);
    expect(res.text).toBe('1');
    expect(
      await db.user.findUnique({ where: { id: f.owner.id } }),
    ).toMatchObject({ status: 'ACTIVE' });
    expect(
      await db.user.findUnique({ where: { id: f.submitter.id } }),
    ).toMatchObject({ role: 'ORGANIZER', status: 'ACTIVE' });
    const application = await db.organizationApplication.findUniqueOrThrow({
      where: { id: f.application.id },
      include: { organization: true, decisions: { include: { email: true } } },
    });
    expect(application).toMatchObject({
      status: 'APPROVED',
      reviewerId: admin,
      reviewerNote: 'verified',
      reviewedAt: expect.any(Date),
      revision: 1,
    });
    expect(application.organization).toMatchObject({
      verificationStatus: 'APPROVED',
      verifiedById: admin,
      verifiedAt: application.reviewedAt,
    });
    expect(application.decisions).toHaveLength(1);
    expect(application.decisions[0]).toMatchObject({
      revision: 1,
      oldStatus: 'PENDING',
      newStatus: 'APPROVED',
      email: { status: 'PENDING' },
    });
  });
  it.each(['reject', 'request-changes'])(
    '%s leaves related states unchanged and prevents further review',
    async (action) => {
      const f = await fixture();
      await post(f.application.id, action).expect(201);
      await post(f.application.id).expect(409);
      expect(
        await db.user.findUnique({ where: { id: f.owner.id } }),
      ).toMatchObject({ status: 'PENDING' });
      expect(
        await db.organization.findUnique({ where: { id: f.org.id } }),
      ).toMatchObject({ verificationStatus: 'PENDING' });
      expect(
        await db.applicationDecision.count({
          where: { applicationId: f.application.id },
        }),
      ).toBe(1);
    },
  );
  it.each([
    'unverified',
    'suspended',
    'wrong-role',
    'future-submission',
    'incomplete-organization',
  ] as const)('blocks %s application for all decisions', async (kind) => {
    const f = await fixture();
    if (kind === 'unverified')
      await db.user.update({
        where: { id: f.submitter.id },
        data: { emailVerifiedAt: null },
      });
    if (kind === 'suspended')
      await db.user.update({
        where: { id: f.submitter.id },
        data: { status: 'SUSPENDED' },
      });
    if (kind === 'wrong-role')
      await db.user.update({
        where: { id: f.submitter.id },
        data: { role: 'STUDENT' },
      });
    if (kind === 'future-submission')
      await db.organizationApplication.update({
        where: { id: f.application.id },
        data: { submittedAt: new Date('2100-01-01') },
      });
    if (kind === 'incomplete-organization')
      await db.organization.update({
        where: { id: f.org.id },
        data: { orgName: '' },
      });
    for (const action of ['approve', 'reject', 'request-changes'])
      await post(f.application.id, action).expect(409);
    expect(
      await db.applicationDecision.count({
        where: { applicationId: f.application.id },
      }),
    ).toBe(0);
    await request(app.getHttpServer())
      .get(`/api/admin/applications/${f.application.id}/review`)
      .set('Cookie', cookie)
      .expect(404);
  });
  it('distinguishes missing and invalid IDs', async () => {
    await post(randomUUID()).expect(404);
    await post('bad-id').expect(400);
    await request(app.getHttpServer())
      .get(`/api/admin/applications/${randomUUID()}/review`)
      .set('Cookie', cookie)
      .expect(404);
  });
  it.each([
    {},
    { reason: ' ', expectedRevision: 1 },
    { reason: null, expectedRevision: 1 },
    { reason: 'x'.repeat(101), expectedRevision: 1 },
    { reason: 'ok' },
    { reason: 'ok', expectedRevision: 0 },
    { reason: 'ok', expectedRevision: 1.5 },
    { reason: 'ok', expectedRevision: '1' },
    { reason: 'ok', expectedRevision: 1, reviewerId: 'spoof' },
  ])('rejects invalid body %j', async (body) => {
    const f = await fixture();
    await post(f.application.id, 'approve', body).expect(400);
    expect(
      await db.applicationDecision.count({
        where: { applicationId: f.application.id },
      }),
    ).toBe(0);
  });
  it.each(['approve', 'reject', 'request-changes'])(
    'enforces real session and admin eligibility for %s',
    async (action) => {
      const f = await fixture();
      await post(f.application.id, action, undefined, '').expect(401);
      for (const [role, status, verified] of [
        ['STUDENT', 'ACTIVE', true],
        ['ORGANIZER', 'ACTIVE', true],
        ['ADMIN', 'PENDING', true],
        ['ADMIN', 'SUSPENDED', true],
        ['ADMIN', 'ACTIVE', false],
      ] as const) {
        const account = await user(role, status, verified);
        const token = `access_token=${await jwt.signAsync({ sub: account.id })}`;
        await post(f.application.id, action, undefined, token).expect(403);
      }
    },
  );
  it('reevaluates administrator verification after token issuance', async () => {
    const account = await user('ADMIN', 'ACTIVE');
    const token = `access_token=${await jwt.signAsync({ sub: account.id })}`;
    await db.user.update({
      where: { id: account.id },
      data: { emailVerifiedAt: null },
    });
    const f = await fixture();
    await post(f.application.id, 'approve', undefined, token).expect(403);
  });
  it('rolls back application and organization writes for suspended owner', async () => {
    const f = await fixture('SUSPENDED');
    await post(f.application.id).expect(409);
    expect(
      await db.organizationApplication.findUnique({
        where: { id: f.application.id },
      }),
    ).toMatchObject({ status: 'PENDING', reviewerId: null });
    expect(
      await db.organization.findUnique({ where: { id: f.org.id } }),
    ).toMatchObject({ verificationStatus: 'PENDING', verifiedAt: null });
    expect(
      await db.applicationDecision.count({
        where: { applicationId: f.application.id },
      }),
    ).toBe(0);
  });
  it('rolls back triple update if the real history constraint fails', async () => {
    const f = await fixture();
    await expect(
      service.approveApplication(f.application.id, admin, 'x'.repeat(101), 1),
    ).rejects.toThrow();
    expect(
      await db.organizationApplication.findUnique({
        where: { id: f.application.id },
      }),
    ).toMatchObject({ status: 'PENDING' });
    expect(
      await db.organization.findUnique({ where: { id: f.org.id } }),
    ).toMatchObject({ verificationStatus: 'PENDING' });
    expect(
      await db.user.findUnique({ where: { id: f.owner.id } }),
    ).toMatchObject({ status: 'PENDING' });
    expect(
      await db.applicationDecision.count({
        where: { applicationId: f.application.id },
      }),
    ).toBe(0);
  });
  it.each([
    'organizations',
    'users',
    'application_decisions',
    'decision_emails',
  ] as const)(
    'rolls back every approval write when PostgreSQL rejects %s persistence',
    async (table) => {
      const f = await fixture();
      const name = `fail_admin_${randomUUID().replaceAll('-', '')}`;
      // Identifiers and literals below come only from suite-generated UUID fixtures.
      const condition =
        table === 'organizations'
          ? `NEW.id = '${f.org.id}'::uuid`
          : table === 'users'
            ? `NEW.id = '${f.owner.id}'::uuid`
            : table === 'application_decisions'
              ? `NEW.application_id = '${f.application.id}'::uuid`
              : `NEW.recipient = '${f.owner.email}'`;
      await db.$executeRawUnsafe(
        `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected isolated test write failure'; END $$`,
      );
      try {
        await db.$executeRawUnsafe(
          `CREATE TRIGGER ${name} BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW WHEN (${condition}) EXECUTE FUNCTION ${name}()`,
        );
        await expect(
          service.approveApplication(f.application.id, admin, 'ok', 1),
        ).rejects.toThrow();
        expect(
          await db.organizationApplication.findUnique({
            where: { id: f.application.id },
          }),
        ).toMatchObject({
          status: 'PENDING',
          reviewerId: null,
          reviewedAt: null,
        });
        expect(
          await db.organization.findUnique({ where: { id: f.org.id } }),
        ).toMatchObject({ verificationStatus: 'PENDING', verifiedAt: null });
        expect(
          await db.user.findUnique({ where: { id: f.owner.id } }),
        ).toMatchObject({ status: 'PENDING' });
        expect(
          await db.applicationDecision.count({
            where: { applicationId: f.application.id },
          }),
        ).toBe(0);
        expect(
          await db.decisionEmail.count({ where: { recipient: f.owner.email } }),
        ).toBe(0);
      } finally {
        await db.$executeRawUnsafe(
          `DROP TRIGGER IF EXISTS ${name} ON ${table}`,
        );
        await db.$executeRawUnsafe(`DROP FUNCTION ${name}()`);
      }
    },
  );
  it('allows exactly one competing administrator decision', async () => {
    const f = await fixture();
    const results = await Promise.all([
      post(f.application.id),
      post(f.application.id, 'reject'),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(
      await db.applicationDecision.count({
        where: { applicationId: f.application.id },
      }),
    ).toBe(1);
    expect(
      await db.decisionEmail.count({
        where: { decision: { applicationId: f.application.id } },
      }),
    ).toBe(1);
  });
  it('rejects stale revisions after a transactional resubmission and exposes history', async () => {
    const f = await fixture();
    await post(f.application.id, 'request-changes').expect(201);
    await db.$transaction((tx) =>
      advanceApplicationRevision(tx, f.application.id, 1),
    );
    await post(f.application.id).expect(409);
    await post(f.application.id, 'approve', {
      reason: 'corrected',
      expectedRevision: 2,
    }).expect(201);
    const res = await request(app.getHttpServer())
      .get(`/api/admin/applications/${f.application.id}/review`)
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body.revision).toBe(2);
    expect(res.body.organization).toMatchObject({
      orgName: 'Test',
      type: 'STUDENT_CLUB',
    });
    expect(res.body.submittedBy).toMatchObject({ email: f.submitter.email });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(
      res.body.decisions.map((d: { revision: number }) => d.revision),
    ).toEqual([1, 2]);
    await expect(
      db.$transaction((tx) =>
        advanceApplicationRevision(tx, f.application.id, 2),
      ),
    ).rejects.toThrow();
  });

  it('publishes the corrected organizer draft once and preserves revision history', async () => {
    const lina = await user('ORGANIZER', 'PENDING');
    const token = await jwt.signAsync({ sub: lina.id });
    const organizerCookie = `access_token=${token}`;

    const original = {
      type: 'STUDENT_CLUB' as const,
      representativeFullName: 'Lina Test',
      academicPosition: 'Elected President',
      phoneNumber: '+212612345679',
    };

    await db.organization.create({
      data: {
        ...original,
        ownerId: lina.id,
        orgName: 'Campus Robotics',
        verificationStatus: 'PENDING',
      },
    });

    const http = request(app.getHttpServer());
    const base = '/api/organizer-applications';
    const saveDraft = (fields: object) =>
      http.post(`${base}/draft`).set('Cookie', organizerCookie).send(fields);
    const submit = () =>
      http.post(`${base}/submit`).set('Cookie', organizerCookie);

    const organizationName = 'Atlas Robotics Lab';
    await saveDraft({ ...original, organizationName }).expect(200);
    const first = await submit().expect(201);
    expect(first.body).toMatchObject({
      id: expect.any(String),
      status: 'PENDING',
      revision: 1,
    });

    const id = first.body.id;
    const review = () =>
      http.get(`/api/admin/applications/${id}/review`).set('Cookie', cookie);

    const reason = 'Please clarify your responsibilities as elected president.';
    await post(id, 'request-changes', { reason, expectedRevision: 1 }).expect(201);

    const academicPosition = 'Elected President and workshop coordinator';
    const draft = await saveDraft({ academicPosition }).expect(200);
    expect(draft.body).toMatchObject({
      ...original,
      organizationName,
      academicPosition,
      ownerId: lina.id,
    });

    const before = await review().expect(200);
    expect(before.body).toMatchObject({
      status: 'NEEDS_CHANGES',
      revision: 1,
      organization: { academicPosition: original.academicPosition },
    });

    const second = await submit().expect(201);
    expect(second.body).toMatchObject({ id, status: 'PENDING', revision: 2 });
    await http.get(`${base}/draft`).set('Cookie', organizerCookie).expect(404);
    await submit().expect(409);

    const after = await review().expect(200);
    expect(after.body).toMatchObject({
      id,
      status: 'PENDING',
      revision: 2,
      submittedById: lina.id,
      reviewerId: null,
      reviewerNote: null,
      reviewedAt: null,
      organization: { orgName: organizationName, academicPosition },
      decisions: [
        { revision: 1, oldStatus: 'PENDING', newStatus: 'NEEDS_CHANGES', reason },
      ],
    });
  });
  it('rolls back revision when submitted-data persistence fails', async () => {
    const f = await fixture();
    await expect(
      db.$transaction(async (tx) => {
        await advanceApplicationRevision(tx, f.application.id, 1);
        await tx.organization.update({
          where: { id: f.org.id },
          data: { orgName: 'x'.repeat(256) },
        });
      }),
    ).rejects.toThrow();
    expect(
      await db.organizationApplication.findUnique({
        where: { id: f.application.id },
      }),
    ).toMatchObject({ revision: 1, status: 'PENDING' });
  });
  it('allows only one competing resubmission of a revision', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      db.$transaction((tx) =>
        advanceApplicationRevision(tx, f.application.id, 1),
      ),
      db.$transaction((tx) =>
        advanceApplicationRevision(tx, f.application.id, 1),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await db.organizationApplication.findUnique({
        where: { id: f.application.id },
      }),
    ).toMatchObject({ revision: 2 });
  });
  it('accepts exactly 100 characters after trimming', async () => {
    const f = await fixture();
    await post(f.application.id, 'reject', {
      reason: '  ' + 'x'.repeat(100) + '  ',
      expectedRevision: 1,
    }).expect(201);
  });
  it('serializes review against revision updates', async () => {
    const f = await fixture();
    const result = await Promise.allSettled([
      service.approveApplication(f.application.id, admin, 'ok', 1),
      db.$transaction((tx) =>
        advanceApplicationRevision(tx, f.application.id, 1),
      ),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const saved = await db.organizationApplication.findUniqueOrThrow({
      where: { id: f.application.id },
    });
    expect(
      saved.status === 'APPROVED' ? saved.revision === 1 : saved.revision === 2,
    ).toBe(true);
  });
  it('keeps decisions on email failure, retries with stable identity, and prevents duplicate dispatch', async () => {
    // Isolate this dispatcher from other test notifications using far-future due time.
    const f = await fixture();
    await post(f.application.id).expect(201);
    const row = await db.decisionEmail.findFirstOrThrow({
      where: { decision: { applicationId: f.application.id } },
    });
    await db.decisionEmail.updateMany({
      data: { nextAttemptAt: new Date('2100-01-01') },
      where: { decision: { adminId: admin } },
    });
    await db.decisionEmail.update({
      where: { id: row.id },
      data: { nextAttemptAt: new Date(0) },
    });
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('secret SMTP error'))
      .mockResolvedValue(undefined);
    const dispatcher = new DecisionEmailDispatcher(db, {
      sendDecisionEmail: send,
    });
    const now = new Date();
    await dispatcher.dispatchOne(now);
    expect(
      await db.decisionEmail.findUnique({ where: { id: row.id } }),
    ).toMatchObject({
      status: 'FAILED',
      attempts: 1,
      lastError: 'Decision email delivery failed',
    });
    expect(await dispatcher.dispatchOne(now)).toBe(false);
    await Promise.all([
      dispatcher.dispatchOne(new Date(now.getTime() + 61_000)),
      dispatcher.dispatchOne(new Date(now.getTime() + 61_000)),
    ]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
    expect(
      await db.decisionEmail.findUnique({ where: { id: row.id } }),
    ).toMatchObject({ status: 'SENT', attempts: 2 });
    expect(
      await db.applicationDecision.count({
        where: { applicationId: f.application.id },
      }),
    ).toBe(1);
    expect(
      await dispatcher.dispatchOne(new Date(now.getTime() + 120_000)),
    ).toBe(false);
  });
  it('wires the application dispatcher to the shared MailService', async () => {
    await db.decisionEmail.updateMany({
      where: { decision: { adminId: admin } },
      data: { nextAttemptAt: new Date('2100-01-01') },
    });
    const f = await fixture();
    await post(f.application.id, 'reject').expect(201);
    const send = vi
      .spyOn(app.get(MailService), 'sendDecisionEmail')
      .mockResolvedValue(undefined);
    try {
      await app.get(DecisionEmailDispatcher).dispatchOne();
      expect(send).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          recipient: f.owner.email,
          status: 'REJECTED',
          reason: 'verified',
          messageId: expect.any(String),
        }),
      );
      expect(
        await db.decisionEmail.findFirst({
          where: { decision: { applicationId: f.application.id } },
        }),
      ).toMatchObject({ status: 'SENT' });
    } finally {
      send.mockRestore();
    }
  });
  it('exhausts bounded retries on permanent delivery failure', async () => {
    const f = await fixture();
    await post(f.application.id, 'reject').expect(201);
    const row = await db.decisionEmail.findFirstOrThrow({
      where: { decision: { applicationId: f.application.id } },
    });
    await db.decisionEmail.update({
      where: { id: row.id },
      data: { attempts: 4 },
    });
    const send = vi.fn().mockRejectedValue(new Error('permanent'));
    const dispatcher = new DecisionEmailDispatcher(db, {
      sendDecisionEmail: send,
    });
    await dispatcher.dispatchOne();
    expect(
      await db.decisionEmail.findUnique({ where: { id: row.id } }),
    ).toMatchObject({ status: 'EXHAUSTED', attempts: 5 });
  });
});
