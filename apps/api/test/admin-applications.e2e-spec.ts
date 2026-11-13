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
  VerificationStatus,
} from '../src/generated/prisma/enums.js';

describe('Admin application reads with PostgreSQL and real JWT guards', () => {
  let app: INestApplication;
  let db: PrismaService;
  let jwt: JwtService;
  let adminId: string;
  let cookie: string;
  const users: string[] = [];
  const organizations: string[] = [];
  const eligible: {
    id: string;
    organizationId: string;
    submittedById: string;
    status: VerificationStatus;
  }[] = [];
  const ineligible: string[] = [];
  let draftOrganizationId: string;
  const previousDatabaseUrl = process.env.DATABASE_URL;

  async function createUser(
    options: { role?: UserRole; status?: UserStatus; verified?: boolean } = {},
  ) {
    const user = await db.user.create({
      data: {
        firstName: 'Sara',
        lastName: 'Review fixture',
        email: `admin-read-${randomUUID()}@example.test`,
        passwordHash: `private-hash-${randomUUID()}`,
        role: options.role ?? UserRole.ORGANIZER,
        status: options.status ?? UserStatus.PENDING,
        emailVerifiedAt: options.verified === false ? null : new Date(),
      },
    });
    users.push(user.id);
    return user;
  }

  async function createApplication(
    options: {
      status?: VerificationStatus;
      verified?: boolean;
      userStatus?: UserStatus;
      role?: UserRole;
      emptyName?: boolean;
      draft?: boolean;
      future?: boolean;
      submittedAt?: Date;
    } = {},
  ) {
    const user = await createUser({
      role: options.role,
      status: options.userStatus,
      verified: options.verified,
    });
    const organization = await db.organization.create({
      data: {
        ownerId: user.id,
        orgName: options.emptyName ? '' : 'Campus Robotics Club',
        type: 'STUDENT_CLUB',
        representativeFullName: 'Sara Review fixture',
        academicPosition: 'Coordinator',
        phoneNumber: '+212612345678',
        proofUrl: null,
        verificationStatus: options.status ?? 'PENDING',
      },
    });
    organizations.push(organization.id);
    if (options.draft) return { user, organization, application: null };
    const status = options.status ?? 'PENDING';
    const application = await db.organizationApplication.create({
      data: {
        organizationId: organization.id,
        submittedById: user.id,
        status,
        submittedAt: options.future
          ? new Date(Date.now() + 86_400_000)
          : (options.submittedAt ?? new Date('2026-01-01T12:00:00Z')),
        reviewerId: status === 'PENDING' ? null : adminId,
        reviewerNote:
          status === 'PENDING' ? null : 'Current document reviewed.',
        reviewedAt:
          status === 'PENDING' ? null : new Date('2026-01-02T12:00:00Z'),
      },
    });
    return { user, organization, application };
  }

  async function session(id: string) {
    return `access_token=${await jwt.signAsync({ sub: id })}`;
  }

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !decodeURIComponent(new URL(url).pathname).endsWith('_test')) {
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
    db = app.get(PrismaService);
    jwt = app.get(JwtService);
    adminId = (
      await createUser({ role: UserRole.ADMIN, status: UserStatus.ACTIVE })
    ).id;
    cookie = await session(adminId);

    for (const status of [
      'PENDING',
      'PENDING',
      'APPROVED',
      'NEEDS_CHANGES',
      'REJECTED',
    ] as const) {
      const fixture = await createApplication({ status });
      eligible.push(fixture.application!);
    }
    for (const options of [
      { verified: false },
      { userStatus: UserStatus.SUSPENDED },
      { role: UserRole.STUDENT, userStatus: UserStatus.ACTIVE },
      { emptyName: true },
      { future: true },
    ]) {
      ineligible.push((await createApplication(options)).application!.id);
    }
    draftOrganizationId = (await createApplication({ draft: true }))
      .organization.id;
    await db.emailVerificationToken.create({
      data: {
        userId: eligible[0]!.submittedById,
        tokenHash: `private-token-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
  }, 30_000);

  afterAll(async () => {
    try {
      if (db) {
        await db.organizationApplication.deleteMany({
          where: { organizationId: { in: organizations } },
        });
        await db.organization.deleteMany({
          where: { id: { in: organizations } },
        });
        await db.emailVerificationToken.deleteMany({
          where: { userId: { in: users } },
        });
        await db.user.deleteMany({ where: { id: { in: users } } });
      }
    } finally {
      if (app) await app.close();
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it('lists only eligible submissions with stable ordering, safe fields and no caching', async () => {
    const before = await db.organizationApplication.findMany({
      orderBy: { id: 'asc' },
    });
    const result = await request(app.getHttpServer())
      .get('/api/admin/applications')
      .set('Cookie', cookie)
      .expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).toMatchObject({
      total: 5,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(result.body.items.map((item: { id: string }) => item.id)).toEqual(
      eligible
        .map((item) => item.id)
        .sort()
        .reverse(),
    );
    for (const item of result.body.items) {
      expect(Object.keys(item).sort()).toEqual(
        [
          'id',
          'orgName',
          'representativeFullName',
          'status',
          'submittedAt',
        ].sort(),
      );
    }
    expect(
      await db.organizationApplication.findMany({ orderBy: { id: 'asc' } }),
    ).toEqual(before);
    // A current-schema draft is an organization without an application row.
    expect(
      await db.organizationApplication.count({
        where: { organizationId: draftOrganizationId },
      }),
    ).toBe(0);
  });

  it.each(Object.values(VerificationStatus))(
    'filters by application status %s',
    async (status) => {
      const result = await request(app.getHttpServer())
        .get('/api/admin/applications')
        .query({ status })
        .set('Cookie', cookie)
        .expect(200);
      expect(result.body.total).toBe(
        eligible.filter((item) => item.status === status).length,
      );
      expect(
        result.body.items.every(
          (item: { status: string }) => item.status === status,
        ),
      ).toBe(true);
    },
  );

  it('paginates without overlaps and returns an explicit empty out-of-range page', async () => {
    const pages: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const result = await request(app.getHttpServer())
        .get('/api/admin/applications')
        .query({ page, limit: 2 })
        .set('Cookie', cookie)
        .expect(200);
      expect(result.body).toMatchObject({
        total: 5,
        page,
        limit: 2,
        totalPages: 3,
        hasNextPage: page < 3,
        hasPreviousPage: page > 1,
      });
      pages.push(...result.body.items.map((item: { id: string }) => item.id));
    }
    expect(pages).toEqual(
      eligible
        .map((item) => item.id)
        .sort()
        .reverse(),
    );
    expect(new Set(pages).size).toBe(5);
    const empty = await request(app.getHttpServer())
      .get('/api/admin/applications?page=4&limit=2')
      .set('Cookie', cookie)
      .expect(200);
    expect(empty.body).toMatchObject({
      items: [],
      total: 5,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('enforces the default and maximum page sizes against more than 100 real records', async () => {
    const ids = Array.from({ length: 101 }, () => randomUUID());
    try {
      await db.organizationApplication.createMany({
        data: ids.map((id) => ({
          id,
          organizationId: eligible[0]!.organizationId,
          submittedById: eligible[0]!.submittedById,
          status: VerificationStatus.PENDING,
        })),
      });
      const defaults = await request(app.getHttpServer())
        .get('/api/admin/applications')
        .set('Cookie', cookie)
        .expect(200);
      expect(defaults.body.items).toHaveLength(20);
      expect(defaults.body.total).toBe(106);
      const maximum = await request(app.getHttpServer())
        .get('/api/admin/applications?limit=100')
        .set('Cookie', cookie)
        .expect(200);
      expect(maximum.body.items).toHaveLength(100);
      expect(maximum.body.hasNextPage).toBe(true);
      await request(app.getHttpServer())
        .get('/api/admin/applications?limit=101')
        .set('Cookie', cookie)
        .expect(400);
    } finally {
      await db.organizationApplication.deleteMany({
        where: { id: { in: ids } },
      });
    }
  });

  it('returns safe detail matching the S2-05 view model, including an optional proof and decision reason', async () => {
    const application = eligible.find(
      (item) => item.status === 'NEEDS_CHANGES',
    )!;
    const submitter = await db.user.findUniqueOrThrow({
      where: { id: application.submittedById },
    });
    const result = await request(app.getHttpServer())
      .get(`/api/admin/applications/${application.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).toEqual({
      id: application.id,
      orgName: 'Campus Robotics Club',
      representativeFullName: 'Sara Review fixture',
      status: 'NEEDS_CHANGES',
      submittedAt: '2026-01-01T12:00:00.000Z',
      type: 'STUDENT_CLUB',
      academicPosition: 'Coordinator',
      phoneNumber: '+212612345678',
      proofUrl: null,
      submittedBy: {
        firstName: 'Sara',
        lastName: 'Review fixture',
        email: submitter.email,
      },
      reviewerNote: 'Current document reviewed.',
      reviewedAt: '2026-01-02T12:00:00.000Z',
    });
    expect(JSON.stringify(result.body)).not.toMatch(
      /password|token|ownedOrganizations|emailVerifiedAt/i,
    );
  });

  it('returns null reason/date for an unreviewed application without requiring a supporting document', async () => {
    const result = await request(app.getHttpServer())
      .get(`/api/admin/applications/${eligible[0]!.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(result.body).toMatchObject({
      reviewerNote: null,
      reviewedAt: null,
      proofUrl: null,
      status: 'PENDING',
    });
  });

  it('returns 404 for missing, draft organization IDs, and ineligible applications', async () => {
    for (const id of [randomUUID(), draftOrganizationId, ...ineligible]) {
      await request(app.getHttpServer())
        .get(`/api/admin/applications/${id}`)
        .set('Cookie', cookie)
        .expect(404);
    }
  });

  it.each(['', 'access_token=invalid'])(
    'rejects anonymous or malformed sessions (%s) before reading data',
    async (sessionCookie) => {
      for (const path of [
        '/api/admin/applications',
        `/api/admin/applications/${eligible[0]!.id}`,
      ]) {
        await request(app.getHttpServer())
          .get(path)
          .set('Cookie', sessionCookie)
          .expect(401);
      }
    },
  );

  it('rejects expired and deleted-user sessions', async () => {
    const expired = await jwt.signAsync({ sub: adminId }, { expiresIn: -5 });
    for (const value of [
      `access_token=${expired}`,
      await session(randomUUID()),
    ]) {
      await request(app.getHttpServer())
        .get('/api/admin/applications')
        .set('Cookie', value)
        .expect(401);
    }
  });

  it.each([
    { role: UserRole.STUDENT, status: UserStatus.ACTIVE },
    { role: UserRole.ORGANIZER, status: UserStatus.ACTIVE },
    { role: UserRole.ORGANIZER, status: UserStatus.PENDING },
    { role: UserRole.ADMIN, status: UserStatus.PENDING },
    { role: UserRole.ADMIN, status: UserStatus.SUSPENDED },
    { role: UserRole.ADMIN, status: UserStatus.ACTIVE, verified: false },
  ])('rejects non-admin and ineligible admin readers: %j', async (options) => {
    const user = await createUser(options);
    const value = await session(user.id);
    for (const path of [
      '/api/admin/applications',
      `/api/admin/applications/${eligible[0]!.id}`,
    ]) {
      await request(app.getHttpServer())
        .get(path)
        .set('Cookie', value)
        .expect(403);
    }
  });

  it('rechecks persisted roles instead of trusting role claims or a previously authorized cookie', async () => {
    const user = await createUser({
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    const value = `access_token=${await jwt.signAsync({ sub: user.id, role: 'ADMIN' })}`;
    await db.user.update({
      where: { id: user.id },
      data: { role: UserRole.STUDENT },
    });
    await request(app.getHttpServer())
      .get('/api/admin/applications')
      .set('Cookie', value)
      .expect(403);
  });

  it('reads the latest persisted decision state without implementing a decision write', async () => {
    const application = eligible[0]!;
    try {
      // This fixture update simulates S2-09 persistence, not an implemented decision endpoint.
      await db.organizationApplication.update({
        where: { id: application.id },
        data: {
          status: 'APPROVED',
          reviewerNote: 'Approved by another reviewer',
          reviewedAt: new Date(),
        },
      });
      const detail = await request(app.getHttpServer())
        .get(`/api/admin/applications/${application.id}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(detail.body).toMatchObject({
        status: 'APPROVED',
        reviewerNote: 'Approved by another reviewer',
      });
      const list = await request(app.getHttpServer())
        .get('/api/admin/applications?status=PENDING')
        .set('Cookie', cookie)
        .expect(200);
      expect(
        list.body.items.some(
          (item: { id: string }) => item.id === application.id,
        ),
      ).toBe(false);
    } finally {
      await db.organizationApplication.update({
        where: { id: application.id },
        data: { status: 'PENDING', reviewerNote: null, reviewedAt: null },
      });
    }
  });

  it.each([
    'page=0',
    'page=1.5',
    'limit=101',
    'limit=1&limit=2',
    'status=DRAFT',
    'status=PENDING&status=APPROVED',
    'userId=other',
    'include=passwordHash',
  ])('rejects invalid query %s through HTTP', async (query) => {
    await request(app.getHttpServer())
      .get(`/api/admin/applications?${query}`)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('rechecks submitter verification and returns an empty filtered page when eligibility changes', async () => {
    const pending = eligible.filter((item) => item.status === 'PENDING');
    const ids = pending.map((item) => item.submittedById);
    try {
      await db.user.updateMany({
        where: { id: { in: ids } },
        data: { emailVerifiedAt: null },
      });
      const result = await request(app.getHttpServer())
        .get('/api/admin/applications?status=PENDING')
        .set('Cookie', cookie)
        .expect(200);
      expect(result.body).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });
      await request(app.getHttpServer())
        .get(`/api/admin/applications/${pending[0]!.id}`)
        .set('Cookie', cookie)
        .expect(404);
    } finally {
      await db.user.updateMany({
        where: { id: { in: ids } },
        data: { emailVerifiedAt: new Date() },
      });
    }
  });

  it('rejects malformed UUIDs', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/applications/not-a-uuid')
      .set('Cookie', cookie)
      .expect(400);
  });

  it('documents the read routes, cookie authorization, bounds, enums and exact response fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const paths = response.body.paths;
    const list = paths['/api/admin/applications'].get;
    expect(list.security).toEqual([{ cookie: [] }]);
    expect(
      list.parameters
        .map((parameter: { name: string }) => parameter.name)
        .sort(),
    ).toEqual(['limit', 'page', 'status']);
    expect(
      list.parameters.find(
        (parameter: { name: string }) => parameter.name === 'limit',
      ).schema,
    ).toMatchObject({ default: 20, minimum: 1, maximum: 100 });
    expect(
      list.parameters.find(
        (parameter: { name: string }) => parameter.name === 'status',
      ).schema.enum,
    ).toEqual(Object.values(VerificationStatus));
    expect(list.responses['200'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/AdminApplicationPageDto',
    );
    expect(
      paths['/api/admin/applications/{id}'].get.responses['404'],
    ).toBeDefined();
    expect(
      Object.keys(
        response.body.components.schemas.AdminApplicationDetailDto.properties,
      ).sort(),
    ).toEqual(
      [
        'id',
        'orgName',
        'representativeFullName',
        'status',
        'submittedAt',
        'type',
        'academicPosition',
        'phoneNumber',
        'proofUrl',
        'submittedBy',
        'reviewerNote',
        'reviewedAt',
      ].sort(),
    );
    expect(Object.keys(paths['/api/admin/applications'])).toEqual(['get']);
    expect(Object.keys(paths['/api/admin/applications/{id}'])).toEqual(['get']);
  });
});
