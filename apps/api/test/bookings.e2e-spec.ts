import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/config/application.js';
import { validateEnvironment } from '../src/config/environment.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Bookings with PostgreSQL and real JWT guards', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userIds: string[] = [];
  let owner: Awaited<ReturnType<typeof organizer>>;
  let other: typeof owner;
  let alice: Awaited<ReturnType<typeof student>>;
  let bob: typeof alice;

  async function account(data: Partial<Prisma.UserCreateInput>) {
    const user = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Participant',
        email: `s303-${randomUUID()}@example.test`,
        passwordHash: 'unused-fixture',
        role: 'STUDENT',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        ...data,
      },
      include: { ownedOrganizations: true },
    });
    userIds.push(user.id);
    const token = await app.get(JwtService).signAsync({ sub: user.id });
    return { ...user, cookie: `access_token=${token}` };
  }

  function student(data: Partial<Prisma.UserCreateInput> = {}) {
    return account({
      studentProfile: { create: { interests: ['HACKATHONS', 'AI_DATA'] } },
      ...data,
    });
  }

  function organizer() {
    return account({
      role: 'ORGANIZER',
      ownedOrganizations: {
        create: {
          orgName: 'S3-03 fixture',
          type: 'COMMUNITY',
          representativeFullName: 'Test Organizer',
          academicPosition: 'Organizer',
          phoneNumber: '+212600000000',
          verificationStatus: 'APPROVED',
        },
      },
    });
  }

  async function event(
    data: Partial<Prisma.EventUncheckedCreateInput> = {},
    organizer = owner,
  ) {
    return prisma.event.create({
      data: {
        createdById: organizer.id,
        organizationId: organizer.ownedOrganizations[0]!.id,
        title: 'Campus workshop',
        description: 'S3-03 fixture',
        format: 'ONLINE',
        startDate: new Date(Date.now() + 3_600_000),
        endDate: new Date(Date.now() + 7_200_000),
        registrationDeadline: new Date(Date.now() + 1_800_000),
        registrationMode: 'AUTOMATIC',
        status: 'PUBLISHED',
        ...data,
      },
    });
  }

  function booking(
    method: 'get' | 'post' | 'delete',
    id: string,
    cookie?: string,
  ) {
    const req = request(app.getHttpServer())[method](
      `/api/events/${id}/my-booking`,
    );
    return cookie ? req.set('Cookie', cookie) : req;
  }

  function list(query: Record<string, string | number>, cookie?: string) {
    const req = request(app.getHttpServer())
      .get('/api/organizer/bookings')
      .query(query);
    return cookie ? req.set('Cookie', cookie) : req;
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
    prisma = app.get(PrismaService);
    [owner, other, alice, bob] = await Promise.all([
      organizer(),
      organizer(),
      student(),
      student(),
    ]);
  }, 30000);

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!prisma) return;
    const where = { createdById: { in: userIds } };
    await prisma.eventRegistration.deleteMany({ where: { event: where } });
    await prisma.event.deleteMany({ where });
  });

  afterAll(async () => {
    try {
      if (prisma) {
        const where = { id: { in: userIds } };
        await prisma.organization.deleteMany({ where: { owner: where } });
        await prisma.studentProfile.deleteMany({ where: { user: where } });
        await prisma.user.deleteMany({ where });
      }
    } finally {
      await app?.close();
    }
  });

  it('requires a verified ACTIVE student with two distinct interests for every operation', async () => {
    const { id } = await event();
    const [unverified, pending, suspended, incomplete, fallback] =
      await Promise.all([
        student({ emailVerifiedAt: null }),
        student({ status: 'PENDING' }),
        student({ status: 'SUSPENDED' }),
        student({
          studentProfile: { create: { interests: ['AI_DATA', 'AI_DATA'] } },
        }),
        student({ role: 'ORGANIZER' }),
      ]);
    for (const method of ['get', 'post', 'delete'] as const) {
      await booking(method, id).expect(401);
      for (const user of [
        owner,
        unverified,
        pending,
        suspended,
        incomplete,
        fallback,
      ]) {
        await booking(method, id, user.cookie).expect(403);
      }
    }
  });

  it('validates event IDs and hides missing or unavailable events', async () => {
    const unavailable = await Promise.all(
      (['DRAFT', 'CANCELLED', 'COMPLETED', 'PENDING_REVIEW'] as const).map(
        (status) => event({ status }),
      ),
    );
    for (const method of ['get', 'post', 'delete'] as const) {
      await booking(method, 'invalid', alice.cookie).expect(400);
      for (const id of [randomUUID(), ...unavailable.map((row) => row.id)]) {
        await booking(method, id, alice.cookie).expect(404);
      }
    }
  });

  it('rejects external mutations and enforces the explicit deadline for both writes', async () => {
    const now = Date.now();
    const [external, missing, passed, boundary, open] = await Promise.all([
      event({ registrationMode: 'EXTERNAL' }),
      event({ registrationDeadline: null }),
      event({ registrationDeadline: new Date(now - 1) }),
      event({ registrationDeadline: new Date(now) }),
      event({ registrationDeadline: new Date(now + 1) }),
    ]);
    vi.spyOn(Date, 'now').mockReturnValue(now);
    await booking('get', external.id, alice.cookie).expect(200, {
      booking: null,
    });
    for (const method of ['post', 'delete'] as const) {
      await booking(method, external.id, alice.cookie)
        .expect(409)
        .expect(({ body }) => {
          expect(body.message).toBe('Event uses external registration');
        });
      for (const { id } of [missing, passed, boundary]) {
        await booking(method, id, alice.cookie)
          .expect(409)
          .expect(({ body }) => {
            expect(body.message).toBe('Registration is closed');
          });
      }
    }
    await booking('post', open.id, alice.cookie).expect(201);
    await booking('delete', open.id, alice.cookie).expect(200);
  });

  it('isolates own reads and cancellation, releases capacity and preserves the cancelled row', async () => {
    const { id } = await event({ capacity: 1 });
    await booking('get', id, alice.cookie)
      .expect(200, { booking: null })
      .expect('Cache-Control', 'no-store');
    const reserved = await booking('post', id, alice.cookie).expect(201);
    expect(reserved.body).toEqual({
      booking: { id: expect.any(String), status: 'CONFIRMED' },
    });
    await booking('get', id, alice.cookie).expect(200, reserved.body);
    await booking('get', id, bob.cookie).expect(200, { booking: null });
    await booking('delete', id, bob.cookie).expect(404);
    await booking('post', id, alice.cookie).expect(409);
    await booking('post', id, bob.cookie).expect(409);
    const cancelled = {
      booking: { id: reserved.body.booking.id, status: 'CANCELLED' },
    };
    await booking('delete', id, alice.cookie).expect(200, cancelled);
    await booking('get', id, alice.cookie).expect(200, cancelled);
    await booking('delete', id, alice.cookie).expect(409);
    await booking('post', id, alice.cookie).expect(409);
    await booking('post', id, bob.cookie).expect(201);
  });

  it('allows unlimited capacity and overlapping times, and allows cancellation on a FULL event', async () => {
    const [first, second] = await Promise.all([event(), event()]);
    await booking('post', first.id, alice.cookie).expect(201);
    await booking('post', first.id, bob.cookie).expect(201);
    await booking('post', second.id, alice.cookie).expect(201);
    await prisma.event.update({
      where: { id: second.id },
      data: { status: 'FULL' },
    });
    await booking('get', second.id, alice.cookie).expect(200);
    await booking('post', second.id, bob.cookie).expect(409);
    await booking('delete', second.id, alice.cookie).expect(200);
    await booking('post', second.id, bob.cookie).expect(409);
  });

  it('serializes last-place and duplicate concurrent requests', async () => {
    const [limited, unlimited] = await Promise.all([
      event({ capacity: 1 }),
      event(),
    ]);
    for (const [id, secondCookie] of [
      [limited.id, bob.cookie],
      [unlimited.id, alice.cookie],
    ]) {
      const responses = await Promise.all([
        booking('post', id, alice.cookie),
        booking('post', id, secondCookie),
      ]);
      expect(
        responses
          .map(({ status }) => status)
          .sort((first, second) => first - second),
      ).toEqual([201, 409]);
      expect(
        await prisma.eventRegistration.count({ where: { eventId: id } }),
      ).toBe(1);
    }
  });

  it('preserves capacity during cancellation and reservation races', async () => {
    const { id } = await event({ capacity: 1 });
    await booking('post', id, alice.cookie).expect(201);
    const [cancel, reserve] = await Promise.all([
      booking('delete', id, alice.cookie),
      booking('post', id, bob.cookie),
    ]);
    expect(cancel.status).toBe(200);
    expect([201, 409]).toContain(reserve.status);
    expect(
      await prisma.eventRegistration.count({
        where: { eventId: id, status: 'CONFIRMED' },
      }),
    ).toBe(reserve.status === 201 ? 1 : 0);
    if (reserve.status === 409)
      await booking('post', id, bob.cookie).expect(201);
    const sameStudent = await Promise.all([
      booking('delete', id, bob.cookie),
      booking('post', id, bob.cookie),
    ]);
    expect(sameStudent.map(({ status }) => status)).toEqual([200, 409]);
    expect(
      await prisma.eventRegistration.count({
        where: { eventId: id, status: 'CONFIRMED' },
      }),
    ).toBe(0);
  });

  it('rolls back a failed database write and leaves the place bookable', async () => {
    const { id } = await event({ capacity: 1 });
    // Force a real PostgreSQL CHECK failure for one fixture student after eligibility checks.
    const constraint = 's303_test_reject_registration';
    // UUID below comes directly from PostgreSQL and the identifier is fixed.
    await prisma.$executeRawUnsafe(
      `ALTER TABLE event_registrations ADD CONSTRAINT ${constraint} CHECK (student_id <> '${alice.id}'::uuid)`,
    );
    try {
      await booking('post', id, alice.cookie).expect(500);
      expect(
        await prisma.eventRegistration.count({ where: { eventId: id } }),
      ).toBe(0);
      await booking('post', id, bob.cookie).expect(201);
    } finally {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE event_registrations DROP CONSTRAINT ${constraint}`,
      );
    }
  });

  it('rejects anonymous, student, unverified, inactive and revoked organizer sessions', async () => {
    const query = { status: 'CONFIRMED' };
    await list(query).expect(401, { statusCode: 401, message: 'Unauthorized' });
    await list(query, alice.cookie).expect(403, {
      statusCode: 403,
      message: 'Forbidden resource',
      error: 'Forbidden',
    });
    await list(query, owner.cookie).expect(200);
    for (const data of [
      { emailVerifiedAt: null },
      { status: 'PENDING' as const },
    ]) {
      await prisma.user.update({ where: { id: owner.id }, data });
      try {
        await list(query, owner.cookie).expect(403);
      } finally {
        await prisma.user.update({
          where: { id: owner.id },
          data: { status: 'ACTIVE', emailVerifiedAt: new Date() },
        });
      }
    }
    const where = { id: owner.ownedOrganizations[0]!.id };
    await prisma.organization.update({
      where,
      data: { verificationStatus: 'REJECTED' },
    });
    try {
      await list(query, owner.cookie).expect(403);
    } finally {
      await prisma.organization.update({
        where,
        data: { verificationStatus: 'APPROVED' },
      });
    }
  });

  it('validates required status, pagination bounds and unknown or repeated query inputs', async () => {
    await list({}, owner.cookie).expect(400, {
      statusCode: 400,
      message: [
        'status must be one of the following values: CONFIRMED, CANCELLED',
      ],
      error: 'Bad Request',
    });
    for (const query of [
      'status=PENDING',
      'status=cancelled',
      'status=CONFIRMED&page=0',
      'status=CONFIRMED&page=1.5',
      'status=CONFIRMED&page=1e2',
      'status=CONFIRMED&page=9007199254740992',
      'status=CONFIRMED&pageSize=0',
      'status=CONFIRMED&pageSize=101',
      'status=CONFIRMED&pageSize=',
      'status=CONFIRMED&page=1&page=2',
      'status=CONFIRMED&status=CANCELLED',
      'status=CONFIRMED&ownerId=some-id',
    ]) {
      await request(app.getHttpServer())
        .get(`/api/organizer/bookings?${query}`)
        .set('Cookie', owner.cookie)
        .expect(400);
    }
    await list({ status: 'CONFIRMED', pageSize: 100 }, owner.cookie).expect(
      200,
      {
        items: [],
        page: 1,
        pageSize: 100,
        total: 0,
      },
    );
  });

  it('paginates a stable, private, status-filtered and owner-scoped participant list', async () => {
    const [mine, theirs, wrongCreator, wrongOrganization] = await Promise.all([
      event(),
      event({}, other),
      event({ createdById: other.id }),
      event({ organizationId: other.ownedOrganizations[0]!.id }),
    ]);
    const registeredAt = new Date('2027-01-10T10:00:00.000Z');
    const confirmedIds = [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    ];
    await prisma.eventRegistration.createMany({
      data: [
        {
          id: confirmedIds[1],
          eventId: mine.id,
          studentId: bob.id,
          status: 'CONFIRMED',
          registeredAt,
        },
        {
          id: confirmedIds[0],
          eventId: mine.id,
          studentId: alice.id,
          status: 'CONFIRMED',
          registeredAt,
        },
        ...[theirs, wrongCreator, wrongOrganization].map(({ id: eventId }) => ({
          eventId,
          studentId: alice.id,
          status: 'CONFIRMED' as const,
          registeredAt,
        })),
        {
          eventId: theirs.id,
          studentId: bob.id,
          status: 'CANCELLED',
          registeredAt,
        },
        {
          eventId: wrongCreator.id,
          studentId: bob.id,
          status: 'PENDING',
          registeredAt,
        },
        {
          eventId: wrongOrganization.id,
          studentId: bob.id,
          status: 'REJECTED',
          registeredAt,
        },
      ],
    });
    for (const [index, attendee] of [alice, bob].entries()) {
      await list(
        { status: 'CONFIRMED', page: index + 1, pageSize: 1 },
        owner.cookie,
      )
        .expect('Cache-Control', 'no-store')
        .expect(200, {
          items: [
            {
              id: confirmedIds[index],
              eventId: mine.id,
              eventTitle: mine.title,
              participantName: 'Test Participant',
              email: attendee.email,
              registeredAt: registeredAt.toISOString(),
              status: 'CONFIRMED',
              cancellationReason: null,
            },
          ],
          page: index + 1,
          pageSize: 1,
          total: 2,
        });
    }
    await list(
      { status: 'CONFIRMED', page: 3, pageSize: 1 },
      owner.cookie,
    ).expect(200, { items: [], page: 3, pageSize: 1, total: 2 });
    await list({ status: 'CANCELLED' }, owner.cookie).expect(200, {
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });

    await booking('delete', mine.id, alice.cookie).expect(200);
    await prisma.eventRegistration.update({
      where: { id: confirmedIds[0] },
      data: { cancellationReason: 'Fixture note' },
    });
    await list({ status: 'CANCELLED' }, owner.cookie).expect(200, {
      items: [
        {
          id: confirmedIds[0],
          eventId: mine.id,
          eventTitle: mine.title,
          participantName: 'Test Participant',
          email: alice.email,
          registeredAt: registeredAt.toISOString(),
          status: 'CANCELLED',
          cancellationReason: 'Fixture note',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    await list({ status: 'CONFIRMED' }, other.cookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body.total).toBe(1);
        expect(
          body.items.map(({ eventId }: { eventId: string }) => eventId),
        ).toEqual([theirs.id]);
      });
  });
});
