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
    format: 'ONLINE',
    onlineUrl: 'https://example.test/meeting',
    startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 8 * 86400000).toISOString(),
    registrationMode: 'AUTOMATIC',
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
        await prisma.eventCategory.deleteMany({ where: { event: events } });
        await prisma.event.deleteMany({ where: events });
        await prisma.category.deleteMany({
          where: { id: { in: categoryIds } },
        });
        await prisma.organization.deleteMany({
          where: { ownerId: { in: userIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      await app?.close();
    }
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
});
