import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { createValidationPipe } from '../config/application.js';
import { OrganizerEventsController } from './organizer-events.controller.js';
import { OrganizerEventsService } from './organizer-events.service.js';

describe('OrganizerEventsController', () => {
  let app: INestApplication;
  let user: AuthenticatedUser | undefined;
  const eventId = 'a7495653-79c3-4fd2-98f5-84f92aa5e2da';
  const service = {
    create: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    publishDraft: vi.fn(),
  };
  const body = {
    title: 'Campus event',
    description: 'A student event',
    format: 'ONLINE',
    startDate: '2026-12-01T10:00:00.000Z',
    endDate: '2026-12-01T12:00:00.000Z',
    registrationMode: 'AUTOMATIC',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrganizerEventsController],
      providers: [{ provide: OrganizerEventsService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          if (!user) throw new UnauthorizedException();
          context.switchToHttp().getRequest().user = user;
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    user = {
      id: 'f278523b-20df-43aa-8244-69bc361629a0',
      email: 'organizer@example.test',
      role: 'ORGANIZER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      ownedOrganizations: [{ id: 'org', verificationStatus: 'APPROVED' }],
    };
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates a draft, reloads it and accepts a partial update using session ownership', async () => {
    service.create.mockResolvedValue({ id: eventId, ...body, status: 'DRAFT' });
    await request(app.getHttpServer())
      .post('/api/organizer-events')
      .send(body)
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(user!.id, body);

    service.findOne.mockResolvedValue({
      id: eventId,
      ...body,
      status: 'DRAFT',
    });
    const read = await request(app.getHttpServer())
      .get(`/api/organizer-events/${eventId}`)
      .expect(200);
    expect(read.headers['cache-control']).toBe('no-store');
    expect(service.findOne).toHaveBeenCalledWith(user!.id, eventId);

    service.update.mockResolvedValue({ ...read.body, title: 'Updated' });
    await request(app.getHttpServer())
      .patch(`/api/organizer-events/${eventId}`)
      .send({ title: ' Updated ' })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(
      user!.id,
      eventId,
      expect.objectContaining({ title: 'Updated' }),
    );
  });

  it('publishes a completed form with 201 and returns the published event', async () => {
    const form = { ...body, onlineUrl: 'https://example.com/meeting' };
    const published = { id: eventId, ...form, status: 'PUBLISHED' };
    service.publish.mockResolvedValue(published);
    const response = await request(app.getHttpServer())
      .post('/api/organizer-events/publish')
      .send(form)
      .expect(201);
    expect(response.body).toEqual(published);
    expect(service.publish).toHaveBeenCalledWith(user!.id, form);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('publishes a saved draft with 200 using only its ID and the session owner', async () => {
    const published = { id: eventId, ...body, status: 'PUBLISHED' };
    service.publishDraft.mockResolvedValue(published);
    const response = await request(app.getHttpServer())
      .post(`/api/organizer-events/${eventId}/publish`)
      .expect(200);
    expect(response.body).toEqual(published);
    expect(service.publishDraft).toHaveBeenCalledWith(user!.id, eventId);
    expect(service.publish).not.toHaveBeenCalled();
  });

  it.each([
    ['post', '/api/organizer-events'],
    ['get', `/api/organizer-events/${eventId}`],
    ['patch', `/api/organizer-events/${eventId}`],
    ['post', '/api/organizer-events/publish'],
    ['post', `/api/organizer-events/${eventId}/publish`],
  ] as const)('requires authentication for %s %s', async (method, path) => {
    user = undefined;
    await request(app.getHttpServer())[method](path).send(body).expect(401);
  });

  it.each([
    'STUDENT',
    'ADMIN',
    'PENDING',
    'NEEDS_CHANGES',
    'REJECTED',
    'SUSPENDED',
  ])('rejects %s access to organizer event routes', async (state) => {
    if (state === 'STUDENT' || state === 'ADMIN') user!.role = state;
    else if (state === 'SUSPENDED') user!.status = state;
    else
      user!.ownedOrganizations[0]!.verificationStatus = state as
        'PENDING' | 'NEEDS_CHANGES' | 'REJECTED';
    await request(app.getHttpServer())
      .post('/api/organizer-events')
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/organizer-events/${eventId}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/organizer-events/${eventId}`)
      .send({ title: 'Updated' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/organizer-events/publish')
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/organizer-events/${eventId}/publish`)
      .expect(403);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.findOne).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
    expect(service.publish).not.toHaveBeenCalled();
    expect(service.publishDraft).not.toHaveBeenCalled();
  });

  it.each(['get', 'patch'] as const)(
    'rejects malformed UUIDs for %s',
    async (method) => {
      await request(app.getHttpServer())
        [method]('/api/organizer-events/123')
        .send({})
        .expect(400);
    },
  );

  it('rejects malformed UUIDs for saved-draft publication', async () => {
    await request(app.getHttpServer())
      .post('/api/organizer-events/123/publish')
      .expect(400);
    expect(service.publishDraft).not.toHaveBeenCalled();
  });

  it.each([
    { title: null },
    { title: ' ' },
    { startDate: null },
    { startDate: '2026-02-30T10:00:00Z' },
    { capacity: 0 },
    { capacity: '10' },
    { onlineUrl: 'ftp://example.com/event' },
    { status: 'PUBLISHED' },
    { createdById: 'another-user' },
    { organizationId: 'another-org' },
  ])('rejects invalid or server-managed fields: %j', async (fields) => {
    await request(app.getHttpServer())
      .patch(`/api/organizer-events/${eventId}`)
      .send(fields)
      .expect(400);
    expect(service.update).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/api/organizer-events/publish')
      .send({ ...body, ...fields })
      .expect(400);
    expect(service.publish).not.toHaveBeenCalled();
  });

  it('requires core fields on creation and permits clearing nullable fields on update', async () => {
    await request(app.getHttpServer())
      .post('/api/organizer-events')
      .send({ title: 'Draft' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/organizer-events/publish')
      .send({ title: 'Draft' })
      .expect(400);
    service.update.mockResolvedValue({ id: eventId, location: null });
    await request(app.getHttpServer())
      .patch(`/api/organizer-events/${eventId}`)
      .send({ location: null })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(
      user!.id,
      eventId,
      expect.objectContaining({ location: null }),
    );
  });

  it('does not expose the generated list and delete routes', async () => {
    await request(app.getHttpServer()).get('/api/organizer-events').expect(404);
    await request(app.getHttpServer())
      .delete(`/api/organizer-events/${eventId}`)
      .expect(404);
  });
});
