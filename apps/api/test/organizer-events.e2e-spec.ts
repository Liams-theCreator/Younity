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
import { OrganizerEventsService } from '../src/organizer-events/organizer-events.service.js';

describe('Organizer events with PostgreSQL and real JWT guards', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: string;
  let cookie: string;
  let otherCookie: string;
  const userIds: string[] = [];
  const categoryIds: string[] = [];
  const base = {
    title: 'S3-01 workflow',
    description: 'Isolated organizer event fixture',
    format: 'ONLINE' as const,
    onlineUrl: 'https://example.test/meeting',
    startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 8 * 86400000).toISOString(),
    registrationMode: 'AUTOMATIC' as const,
    registrationDeadline: new Date(Date.now() + 6 * 86400000).toISOString(),
  };

  const path = (id: string) => `/api/organizer-events/${id}`;

  async function links(id: string) {
    return (await prisma.eventCategory.findMany({ where: { eventId: id } }))
      .map((link) => link.categoryId)
      .sort();
  }

  async function createDraft(fields: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post('/api/organizer-events')
      .set('Cookie', cookie)
      .send({ ...base, categoryIds: [categoryIds[0]], ...fields })
      .expect(201);
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
    const jwt = app.get(JwtService);

    for (let index = 0; index < 2; index++) {
      const user = await prisma.user.create({
        data: {
          firstName: 'Event',
          lastName: 'Organizer',
          email: `s301-${randomUUID()}@example.test`,
          passwordHash: 'unused-fixture',
          role: 'ORGANIZER',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          ownedOrganizations: {
            create: {
              orgName: 'S3-01 fixture',
              type: 'COMMUNITY',
              representativeFullName: 'Test Organizer',
              academicPosition: 'Organizer',
              phoneNumber: '+212600000000',
              verificationStatus: 'APPROVED',
            },
          },
        },
      });
      userIds.push(user.id);
      const session = `access_token=${await jwt.signAsync({ sub: user.id })}`;
      if (index === 0) {
        ownerId = user.id;
        cookie = session;
      } else otherCookie = session;

      const category = await prisma.category.create({
        data: {
          name: `S3-01 ${randomUUID()}`,
          slug: `s301-${randomUUID()}`,
        },
      });
      categoryIds.push(category.id);
    }
  }, 30000);

  afterAll(async () => {
    try {
      if (prisma) {
        const events = { createdById: { in: userIds } };
        await prisma.eventRegistration.deleteMany({ where: { event: events } });
        await prisma.eventCategory.deleteMany({ where: { event: events } });
        await prisma.event.deleteMany({ where: events });
        await prisma.category.deleteMany({
          where: { id: { in: categoryIds } },
        });
        await prisma.organization.deleteMany({
          where: { ownerId: { in: userIds } },
        });
        await prisma.studentProfile.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await app?.close();
    }
  });

  it('discovers only public events with combined filters and protected details', async () => {
    const q = randomUUID();
    const [{ slug: category }] = await prisma.category.findMany({
      where: { id: categoryIds[0] },
    });
    const fields = {
      ...base,
      title: `Workshop ${q}`,
      format: 'HYBRID',
      location: 'Campus, Rabat',
      categoryIds: [categoryIds[0]],
    };
    const draft = await createDraft(fields);
    const published = await request(app.getHttpServer())
      .post('/api/organizer-events/publish')
      .set('Cookie', cookie)
      .send({
        ...fields,
        registrationMode: 'EXTERNAL',
        externalRegistrationUrl: 'https://example.test/register',
      })
      .expect(201);
    const day = base.startDate.slice(0, 10);
    const filters = { q: q.toUpperCase(), category, city: 'rABAT', format: 'HYBRID', from: day, to: day };
    const list = (query: Record<string, string | number>) =>
      request(app.getHttpServer()).get('/api/events').query(query);

    const result = await list(filters).expect(200);
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(result.body).toMatchObject({ page: 1, pageSize: 12, total: 1 });
    expect(result.body.items).toEqual([expect.objectContaining({ id: published.body.id })]);
    expect(result.body.items[0]).not.toHaveProperty('description');
    expect(result.body.items[0]).not.toHaveProperty('externalRegistrationUrl');
    expect(result.body.categories).toContainEqual(expect.objectContaining({ slug: category }));
    for (const change of [
      { category: 'unknown' }, { city: 'Tangier' }, { format: 'ONLINE' },
      { from: '2000-01-01', to: '2000-01-01' }, { q: '%' },
    ]) {
      const empty = await list({ ...filters, ...change }).expect(200);
      expect(empty.body).toMatchObject({ items: [], total: 0, categories: result.body.categories });
    }
    await list({ ...filters, pageSize: 101 }).expect(400);
    await list({ ...filters, from: '2027-02-30' }).expect(400);
    await list({ from: '2027-02-01', to: '2027-01-01' }).expect(400);

    const detail = await request(app.getHttpServer()).get(`/api/events/${published.body.id}`).expect(200);
    expect(detail.body.event).toEqual({
      ...result.body.items[0],
      description: base.description,
      externalRegistrationUrl: 'https://example.test/register',
    });
    expect(detail.body.event).not.toHaveProperty('onlineUrl');
    expect(detail.body.event).not.toHaveProperty('createdById');
    await request(app.getHttpServer()).get(`/api/events/${draft.body.id}`).expect(404);
    await request(app.getHttpServer()).get(`/api/events/${randomUUID()}`).expect(404);
  });

  it('keeps events public for 48 hours after ending and returns missing automatic deadlines as closed', async () => {
    const marker = randomUUID();
    const now = Date.now();
    const hour = 60 * 60 * 1000;

    async function fixture(hoursUntilEnd: number, durationHours = 1) {
      const result = await request(app.getHttpServer())
        .post('/api/organizer-events/publish')
        .set('Cookie', cookie)
        .send({ ...base, title: marker, categoryIds: [categoryIds[0]] })
        .expect(201);
      const endDate = new Date(now + hoursUntilEnd * hour);
      return prisma.event.update({
        where: { id: result.body.id },
        data: {
          startDate: new Date(endDate.getTime() - durationHours * hour),
          endDate,
          registrationDeadline: null,
        },
      });
    }

    const recent = await fixture(-47);
    const mostRecent = await fixture(-2, 60);
    const expired = await fixture(-49);
    const older = await fixture(-72);
    const ongoing = await fixture(1, 4);
    const upcoming = await fixture(48);

    const list = await request(app.getHttpServer())
      .get('/api/events')
      .query({ q: marker })
      .expect(200);
    expect(list.body).toMatchObject({
      total: 4,
      items: [upcoming, ongoing, mostRecent, recent].map(({ id }) => ({
        id, registrationMode: 'AUTOMATIC', registrationDeadline: null, availability: 'CLOSED',
      })),
    });
    const secondPage = await request(app.getHttpServer())
      .get('/api/events')
      .query({ q: marker, page: 2, pageSize: 2 })
      .expect(200);
    expect(secondPage.body).toMatchObject({
      total: 4,
      items: [{ id: mostRecent.id }, { id: recent.id }],
    });
    for (const { id } of [upcoming, ongoing, mostRecent, recent]) {
      const detail = await request(app.getHttpServer()).get(`/api/events/${id}`).expect(200);
      expect(detail.body.event).toMatchObject({
        registrationDeadline: null,
        availability: 'CLOSED',
      });
    }
    for (const { id } of [expired, older]) {
      await request(app.getHttpServer()).get(`/api/events/${id}`).expect(404);
    }
  });

  it('ranks student interests before pagination while preserving anonymous browsing', async () => {
    const marker = randomUUID();
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: 'ai-data' },
    });
    const student = await prisma.user.create({
      data: {
        firstName: 'Discovery', lastName: 'Student', email: `${marker}@example.test`,
        passwordHash: 'unused-fixture', role: 'STUDENT', status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        studentProfile: { create: { interests: ['AI_DATA'] } },
      },
    });
    userIds.push(student.id);
    const studentCookie = `access_token=${await app.get(JwtService).signAsync({ sub: student.id })}`;

    async function publish(categoryId: string, delay: number) {
      return request(app.getHttpServer()).post('/api/organizer-events/publish')
        .set('Cookie', cookie)
        .send({
          ...base, title: marker, categoryIds: [categoryId],
          startDate: new Date(Date.parse(base.startDate) + delay).toISOString(),
        })
        .expect(201);
    }

    const sooner = await publish(categoryIds[0], 0);
    const matched = await publish(category.id, 3600000);
    await prisma.event.update({ where: { id: matched.body.id }, data: { status: 'FULL' } });

    const list = (session?: string, page = 1) => {
      const req = request(app.getHttpServer()).get('/api/events')
        .query({ q: marker, page, pageSize: 1 });
      return session ? req.set('Cookie', session) : req;
    };

    const anonymous = await list().expect(200);
    expect(anonymous.body).toMatchObject({ total: 2, items: [{ id: sooner.body.id }] });
    const invalidSession = await list('access_token=invalid').expect(200);
    expect(invalidSession.body).toEqual(anonymous.body);
    const personalized = await list(studentCookie).expect(200);
    expect(personalized.body).toMatchObject({ total: 2, items: [{ id: matched.body.id, availability: 'FULL' }] });
    const next = await list(studentCookie, 2).expect(200);
    expect(next.body).toMatchObject({ page: 2, total: 2, items: [{ id: sooner.body.id }] });
    const detail = await request(app.getHttpServer()).get(`/api/events/${matched.body.id}`).expect(200);
    expect(detail.body.event).toMatchObject({ availability: 'FULL', externalRegistrationUrl: null });

    await prisma.event.update({ where: { id: sooner.body.id }, data: { capacity: 1 } });
    await prisma.eventRegistration.create({
      data: { eventId: sooner.body.id, studentId: student.id, status: 'CONFIRMED' },
    });
    const atCapacity = await list().expect(200);
    expect(atCapacity.body.items).toMatchObject([{ id: sooner.body.id, availability: 'FULL' }]);

    const ongoing = await publish(category.id, 7200000);
    await prisma.event.update({
      where: { id: ongoing.body.id },
      data: { startDate: new Date(Date.now() - 3600000) },
    });
    const third = await list(studentCookie, 3).expect(200);
    expect(third.body).toMatchObject({ total: 3, items: [{ id: ongoing.body.id }] });
    const second = await list(studentCookie, 2).expect(200);
    expect(second.body).toMatchObject({ total: 3, items: [{ id: sooner.body.id }] });
  });

  it('directly publishes with category links and preserves the event response fields', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/organizer-events/publish')
      .set('Cookie', cookie)
      .send({ ...base, categoryIds })
      .expect(201);
    expect(result.body).toMatchObject({
      ...base,
      createdById: ownerId,
      status: 'PUBLISHED',
    });
    expect(result.body.categoryIds.sort()).toEqual([...categoryIds].sort());
    expect(result.body).not.toHaveProperty('categories');
    expect(await links(result.body.id)).toEqual([...categoryIds].sort());
    await request(app.getHttpServer())
      .patch(path(result.body.id))
      .set('Cookie', cookie)
      .send({ categoryIds: [] })
      .expect(409);
    await request(app.getHttpServer())
      .post(`${path(result.body.id)}/publish`)
      .set('Cookie', cookie)
      .expect(409);
  });

  it('saves, reloads, edits and publishes the same draft with persistent categories', async () => {
    const draft = await createDraft({
      registrationDeadline: null,
      categoryIds: [],
    });
    expect(draft.body).toMatchObject({
      status: 'DRAFT',
      categoryIds: [],
      registrationDeadline: null,
    });
    const edit = await request(app.getHttpServer())
      .patch(path(draft.body.id))
      .set('Cookie', cookie)
      .send({
        title: 'Edited event',
        categoryIds,
        registrationDeadline: base.registrationDeadline,
      })
      .expect(200);
    const read = await request(app.getHttpServer())
      .get(path(draft.body.id))
      .set('Cookie', cookie)
      .expect(200);
    expect(read.headers['cache-control']).toBe('no-store');
    expect(read.body).toEqual(edit.body);
    const published = await request(app.getHttpServer())
      .post(`${path(draft.body.id)}/publish`)
      .set('Cookie', cookie)
      .expect(200);
    expect(published.body).toMatchObject({
      id: draft.body.id,
      title: 'Edited event',
      status: 'PUBLISHED',
    });
    expect(await links(draft.body.id)).toEqual([...categoryIds].sort());
  });

  it('preserves omitted categories, replaces the list, and clears it with []', async () => {
    const draft = await createDraft();
    for (const [fields, expected] of [
      [{ title: 'Only title changed' }, [categoryIds[0]]],
      [{ categoryIds }, categoryIds],
      [{ categoryIds: [categoryIds[1]] }, [categoryIds[1]]],
      [{ categoryIds: [] }, []],
    ] as const) {
      const result = await request(app.getHttpServer())
        .patch(path(draft.body.id))
        .set('Cookie', cookie)
        .send(fields)
        .expect(200);
      expect(result.body.categoryIds.sort()).toEqual([...expected].sort());
      expect(await links(draft.body.id)).toEqual([...expected].sort());
    }
    await request(app.getHttpServer())
      .post(`${path(draft.body.id)}/publish`)
      .set('Cookie', cookie)
      .expect(400);
    expect(
      await prisma.event.findUniqueOrThrow({ where: { id: draft.body.id } }),
    ).toMatchObject({ status: 'DRAFT' });
  });

  it.each([
    { categoryIds: undefined },
    { categoryIds: [] },
    { categoryIds: [randomUUID()] },
    { categoryIds: ['invalid'] },
    { registrationDeadline: undefined },
    { registrationDeadline: null },
    { registrationDeadline: base.endDate },
    { registrationMode: 'EXTERNAL', externalRegistrationUrl: null },
    {
      registrationMode: 'EXTERNAL',
      externalRegistrationUrl: 'ftp://example.test/register',
    },
  ])(
    'rejects invalid direct publication without creating a row: %j',
    async (fields) => {
      const count = await prisma.event.count({
        where: { createdById: ownerId },
      });
      const result = await request(app.getHttpServer())
        .post('/api/organizer-events/publish')
        .set('Cookie', cookie)
        .send({ ...base, categoryIds: [categoryIds[0]], ...fields })
        .expect(400);
      expect(JSON.stringify(result.body.message)).toMatch(
        /categoryIds|registrationDeadline|externalRegistrationUrl/,
      );
      expect(
        await prisma.event.count({ where: { createdById: ownerId } }),
      ).toBe(count);
    },
  );

  it.each([
    { categoryIds: [] },
    { registrationDeadline: null },
    { registrationDeadline: undefined },
  ])(
    'keeps incomplete saved events DRAFT on rejected publication: %j',
    async (fields) => {
      const draft = await createDraft(fields);
      const before = await prisma.event.findUniqueOrThrow({
        where: { id: draft.body.id },
      });
      const savedLinks = await links(draft.body.id);
      await request(app.getHttpServer())
        .post(`${path(draft.body.id)}/publish`)
        .set('Cookie', cookie)
        .expect(400);
      expect(
        await prisma.event.findUniqueOrThrow({ where: { id: draft.body.id } }),
      ).toEqual(before);
      expect(await links(draft.body.id)).toEqual(savedLinks);
    },
  );

  it('rejects an unknown PATCH category without changing event fields or links', async () => {
    const draft = await createDraft();
    const before = await prisma.event.findUniqueOrThrow({
      where: { id: draft.body.id },
    });
    await request(app.getHttpServer())
      .patch(path(draft.body.id))
      .set('Cookie', cookie)
      .send({ title: 'Must not save', categoryIds: [randomUUID()] })
      .expect(400);
    expect(
      await prisma.event.findUniqueOrThrow({ where: { id: draft.body.id } }),
    ).toEqual(before);
    expect(await links(draft.body.id)).toEqual([categoryIds[0]]);
  });

  it('rejects another approved organizer on read, edit and publish', async () => {
    const draft = await createDraft();
    await request(app.getHttpServer())
      .get(path(draft.body.id))
      .set('Cookie', otherCookie)
      .expect(404);
    await request(app.getHttpServer())
      .patch(path(draft.body.id))
      .set('Cookie', otherCookie)
      .send({ title: 'Other organizer', categoryIds: [] })
      .expect(404);
    await request(app.getHttpServer())
      .post(`${path(draft.body.id)}/publish`)
      .set('Cookie', otherCookie)
      .expect(404);
    expect(await links(draft.body.id)).toEqual([categoryIds[0]]);
    expect(
      await prisma.event.findUniqueOrThrow({ where: { id: draft.body.id } }),
    ).toMatchObject({ status: 'DRAFT', title: base.title });
  });

  it.each(['edit', 'publish'])(
    'rejects a concurrent category change during %s',
    async (action) => {
      const draft = await createDraft();
      // Keep the old timestamp distinct even on fast machines.
      await prisma.event.update({
        where: { id: draft.body.id },
        data: { updatedAt: new Date(Date.now() - 10000) },
      });
      const service = app.get(OrganizerEventsService);
      const findOne = service.findOne.bind(service);
      // Inject a committed competing writer after the read; all SQL remains real.
      const read = vi
        .spyOn(service, 'findOne')
        .mockImplementationOnce(async (userId, id) => {
          const snapshot = await findOne(userId, id);
          const concurrent = await request(app.getHttpServer())
            .patch(path(id))
            .set('Cookie', cookie)
            .send({ categoryIds: [categoryIds[1]] })
            .expect(200);
          expect(new Date(concurrent.body.updatedAt).getTime()).toBeGreaterThan(
            snapshot.updatedAt.getTime(),
          );
          return snapshot;
        });
      try {
        if (action === 'edit') {
          await request(app.getHttpServer())
            .patch(path(draft.body.id))
            .set('Cookie', cookie)
            .send({ title: 'Stale change', categoryIds: [] })
            .expect(409);
        } else {
          await request(app.getHttpServer())
            .post(`${path(draft.body.id)}/publish`)
            .set('Cookie', cookie)
            .expect(409);
        }
        expect(await links(draft.body.id)).toEqual([categoryIds[1]]);
        expect(
          await prisma.event.findUniqueOrThrow({
            where: { id: draft.body.id },
          }),
        ).toMatchObject({ status: 'DRAFT', title: base.title });
      } finally {
        read.mockRestore();
      }
    },
  );

  it('publishes external registration without a deadline on both paths', async () => {
    const fields = {
      registrationMode: 'EXTERNAL',
      registrationDeadline: null,
      externalRegistrationUrl: 'https://example.test/register',
    };
    await request(app.getHttpServer())
      .post('/api/organizer-events/publish')
      .set('Cookie', cookie)
      .send({ ...base, categoryIds, ...fields })
      .expect(201);
    const draft = await createDraft(fields);
    await request(app.getHttpServer())
      .post(`${path(draft.body.id)}/publish`)
      .set('Cookie', cookie)
      .expect(200);
  });

  it.each([
    ['edit', 'edit'],
    ['edit', 'publish'],
    ['publish', 'publish'],
  ] as const)(
    'allows only one simultaneous %s / %s using the same snapshot',
    async (first, second) => {
      const draft = await createDraft();
      const service = app.get(OrganizerEventsService);
      const findOne = service.findOne.bind(service);
      let release!: () => void;
      const bothRead = new Promise<void>((resolve) => {
        release = resolve;
      });
      let arrivals = 0;
      // Hold both requests after their reads so they genuinely compete on one version.
      const read = vi
        .spyOn(service, 'findOne')
        .mockImplementation(async (userId, id) => {
          const snapshot = await findOne(userId, id);
          if (++arrivals === 2) release();
          await bothRead;
          return snapshot;
        });
      const actions = [first, second];
      try {
        const responses = await Promise.all(
          actions.map((action, index) =>
            action === 'publish'
              ? request(app.getHttpServer())
                  .post(`${path(draft.body.id)}/publish`)
                  .set('Cookie', cookie)
              : request(app.getHttpServer())
                  .patch(path(draft.body.id))
                  .set('Cookie', cookie)
                  .send({
                    title: `Competing edit ${index}`,
                    categoryIds: [categoryIds[1]],
                  }),
          ),
        );
        expect(
          responses.map((response) => response.status).sort((a, b) => a - b),
        ).toEqual([200, 409]);
        const winner = responses.findIndex(
          (response) => response.status === 200,
        );
        const saved = await prisma.event.findUniqueOrThrow({
          where: { id: draft.body.id },
        });
        expect(saved.status).toBe(
          actions[winner] === 'publish' ? 'PUBLISHED' : 'DRAFT',
        );
        expect(saved.title).toBe(
          actions[winner] === 'publish'
            ? base.title
            : `Competing edit ${winner}`,
        );
        expect(await links(draft.body.id)).toEqual([
          categoryIds[actions[winner] === 'publish' ? 0 : 1],
        ]);
      } finally {
        release();
        read.mockRestore();
      }
    },
  );

  it('rolls back event fields and links if PostgreSQL rejects category persistence', async () => {
    const draft = await createDraft();
    const before = await prisma.event.findUniqueOrThrow({
      where: { id: draft.body.id },
    });
    const count = await prisma.event.count({ where: { createdById: ownerId } });
    const name = `fail_s301_${randomUUID().replaceAll('-', '')}`;
    // Match the existing failure-injection convention; identifiers are generated UUIDs.
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected S3-01 category persistence failure'; END $$`,
    );
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER ${name} BEFORE INSERT ON event_categories FOR EACH ROW WHEN (NEW.category_id = '${categoryIds[1]}'::uuid) EXECUTE FUNCTION ${name}()`,
      );
      const service = app.get(OrganizerEventsService);
      await expect(
        service.update(ownerId, draft.body.id, {
          title: 'Must roll back',
          categoryIds: [categoryIds[1]!],
        }),
      ).rejects.toThrow();
      expect(
        await prisma.event.findUniqueOrThrow({ where: { id: draft.body.id } }),
      ).toEqual(before);
      expect(await links(draft.body.id)).toEqual([categoryIds[0]]);
      await expect(
        service.publish(ownerId, { ...base, categoryIds: [categoryIds[1]!] }),
      ).rejects.toThrow();
      expect(
        await prisma.event.count({ where: { createdById: ownerId } }),
      ).toBe(count);
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS ${name} ON event_categories`,
      );
      await prisma.$executeRawUnsafe(`DROP FUNCTION ${name}()`);
    }
  });

  it.each(['approval', 'suspension'])(
    'rejects the existing JWT after %s changes',
    async (change) => {
      const draft = await createDraft();
      try {
        if (change === 'approval') {
          await prisma.organization.updateMany({
            where: { ownerId },
            data: { verificationStatus: 'REJECTED' },
          });
        } else {
          await prisma.user.update({
            where: { id: ownerId },
            data: { status: 'SUSPENDED' },
          });
        }
        await request(app.getHttpServer())
          .get(path(draft.body.id))
          .set('Cookie', cookie)
          .expect(403);
        await request(app.getHttpServer())
          .patch(path(draft.body.id))
          .set('Cookie', cookie)
          .send({ categoryIds: [] })
          .expect(403);
        await request(app.getHttpServer())
          .post(`${path(draft.body.id)}/publish`)
          .set('Cookie', cookie)
          .expect(403);
        await request(app.getHttpServer())
          .post('/api/organizer-events/publish')
          .set('Cookie', cookie)
          .send({ ...base, categoryIds })
          .expect(403);
        expect(await links(draft.body.id)).toEqual([categoryIds[0]]);
        expect(
          await prisma.event.findUniqueOrThrow({
            where: { id: draft.body.id },
          }),
        ).toMatchObject({ status: 'DRAFT' });
      } finally {
        await prisma.organization.updateMany({
          where: { ownerId },
          data: { verificationStatus: 'APPROVED' },
        });
        await prisma.user.update({
          where: { id: ownerId },
          data: { status: 'ACTIVE' },
        });
      }
    },
  );
});
