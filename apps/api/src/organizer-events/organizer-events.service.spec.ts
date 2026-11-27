import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrganizerEventsService } from './organizer-events.service.js';

describe('OrganizerEventsService', () => {
  let service: OrganizerEventsService;
  const prisma = {
    organization: { findFirst: vi.fn() },
    category: { findMany: vi.fn() },
    event: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
  const categoryId = 'a7495653-79c3-4fd2-98f5-84f92aa5e2da';
  const otherCategoryId = 'b7495653-79c3-4fd2-98f5-84f92aa5e2da';
  const include = { categories: { select: { categoryId: true } } };
  const dto = {
    title: 'Campus event',
    description: 'A student event',
    format: 'ONLINE' as const,
    startDate: '2026-12-01T10:00:00.000Z',
    endDate: '2026-12-01T12:00:00.000Z',
    registrationMode: 'AUTOMATIC' as const,
  };
  const event = {
    id: 'event',
    ...dto,
    startDate: new Date(dto.startDate),
    endDate: new Date(dto.endDate),
    registrationDeadline: new Date('2026-11-30T10:00:00Z'),
    updatedAt: new Date('2026-11-24T10:00:00Z'),
    status: 'DRAFT',
    categories: [],
  };
  const response = { ...event, categoryIds: [] as string[] };
  // Category links are internal; the public response adds only categoryIds.
  const { categories: _categories, ...savedEvent } = response;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new OrganizerEventsService(prisma as unknown as PrismaService);
    prisma.organization.findFirst.mockResolvedValue({ id: 'organization' });
    prisma.event.findFirst.mockResolvedValue(event);
    prisma.category.findMany.mockResolvedValue([{ id: categoryId }]);
  });

  it('persists a draft with server-derived owner and organization', async () => {
    prisma.event.create.mockResolvedValue(event);
    expect(await service.create('owner', dto)).toEqual(savedEvent);
    expect(prisma.organization.findFirst).toHaveBeenCalledWith({
      where: { ownerId: 'owner', verificationStatus: 'APPROVED' },
      select: { id: true },
    });
    expect(prisma.event.create).toHaveBeenCalledWith({
      include,
      data: expect.objectContaining({
        ...dto,
        startDate: event.startDate,
        endDate: event.endDate,
        createdById: 'owner',
        organizationId: 'organization',
        status: 'DRAFT',
      }),
    });
  });

  it('rejects creation without an approved organization', async () => {
    prisma.organization.findFirst.mockResolvedValue(null);
    await expect(service.create('owner', dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it.each(['read', 'update', 'publish'])(
    'returns 404 for a missing or another organizer’s event on %s',
    async (action) => {
      prisma.event.findFirst.mockResolvedValue(null);
      await expect(
        action === 'read'
          ? service.findOne('owner', 'event')
          : action === 'update'
            ? service.update('owner', 'event', { title: 'Changed' })
            : service.publishDraft('owner', 'event'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        include,
        where: {
          id: 'event',
          createdById: 'owner',
          organization: { ownerId: 'owner', verificationStatus: 'APPROVED' },
        },
      });
      expect(prisma.event.update).not.toHaveBeenCalled();
    },
  );

  it('preserves omitted fields, clears nullable fields, and returns the updated event', async () => {
    const saved = { ...event, title: 'Changed', registrationDeadline: null };
    prisma.event.update.mockResolvedValue(saved);
    expect(
      await service.update('owner', 'event', {
        title: 'Changed',
        registrationDeadline: null,
      }),
    ).toEqual({ ...savedEvent, title: 'Changed', registrationDeadline: null });
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'event',
        createdById: 'owner',
        status: 'DRAFT',
        updatedAt: event.updatedAt,
      }),
      include,
      data: expect.objectContaining({
        title: 'Changed',
        description: undefined,
        registrationDeadline: null,
      }),
    });
  });

  it.each(['PENDING_REVIEW', 'PUBLISHED', 'FULL', 'CANCELLED', 'COMPLETED'])(
    'blocks editing an event with status %s',
    async (status) => {
      prisma.event.findFirst.mockResolvedValue({ ...event, status });
      await expect(
        service.update('owner', 'event', { title: 'Changed' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    },
  );

  it('validates dates on creation', async () => {
    await expect(
      service.create('owner', { ...dto, endDate: dto.startDate }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.create).not.toHaveBeenCalled();
  });

  it.each([
    { startDate: '2026-12-02T10:00:00Z' },
    { endDate: '2026-12-01T09:00:00Z' },
    { registrationDeadline: '2026-12-01T11:00:00Z' },
    { startDate: '2026-11-29T10:00:00Z' },
  ])('validates partial dates against persisted fields: %j', async (fields) => {
    await expect(
      service.update('owner', 'event', fields),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  it('returns a conflict if the draft changes during an update', async () => {
    prisma.event.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '7.10.0',
      }),
    );
    await expect(
      service.update('owner', 'event', { title: 'Changed' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('propagates unexpected database errors', async () => {
    const error = new Error('Database unavailable');
    prisma.event.update.mockRejectedValue(error);
    await expect(
      service.update('owner', 'event', { title: 'Changed' }),
    ).rejects.toBe(error);
  });

  it('loads saved category IDs without exposing internal relation objects', async () => {
    prisma.event.findFirst.mockResolvedValue({
      ...event,
      categories: [{ categoryId }],
    });
    expect(await service.findOne('owner', 'event')).toEqual({
      ...savedEvent,
      categoryIds: [categoryId],
    });
  });

  it.each([
    { categoryIds: undefined },
    { categoryIds: [] },
    { categoryIds: [categoryId] },
    { categoryIds: [otherCategoryId] },
  ])(
    'handles PATCH category omission, clearing and replacement: %j',
    async ({ categoryIds }) => {
      prisma.event.findFirst.mockResolvedValue({
        ...event,
        categories: [{ categoryId }],
      });
      prisma.category.findMany.mockResolvedValue(
        (categoryIds ?? []).map((id) => ({ id })),
      );
      const expectedIds = categoryIds ?? [categoryId];
      prisma.event.update.mockResolvedValue({
        ...event,
        categories: expectedIds.map((id) => ({ categoryId: id })),
      });
      expect(
        await service.update(
          'owner',
          'event',
          categoryIds === undefined ? { title: 'Changed' } : { categoryIds },
        ),
      ).toMatchObject({ categoryIds: expectedIds });
      const { data, where } = prisma.event.update.mock.calls[0]![0];
      expect(where).toMatchObject({
        status: 'DRAFT',
        updatedAt: event.updatedAt,
      });
      if (categoryIds === undefined) {
        expect(data).not.toHaveProperty('categories');
        expect(prisma.category.findMany).not.toHaveBeenCalled();
      } else {
        expect(data.updatedAt.getTime()).toBeGreaterThan(
          event.updatedAt.getTime(),
        );
        expect(data.categories).toEqual({
          deleteMany: {},
          create: categoryIds.map((id) => ({ category: { connect: { id } } })),
        });
      }
    },
  );

  it.each([
    { categoryIds: [categoryId, categoryId] },
    { categoryIds: ['invalid'] },
    { categoryIds: [otherCategoryId] },
  ])(
    'rejects invalid draft categories without writing fields or links: %j',
    async ({ categoryIds }) => {
      prisma.category.findMany.mockResolvedValue([]);
      await expect(
        service.create('owner', { ...dto, categoryIds }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.update('owner', 'event', { title: 'Changed', categoryIds }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.event.create).not.toHaveBeenCalled();
      expect(prisma.event.update).not.toHaveBeenCalled();
    },
  );

  describe('publication', () => {
    const completeForm = {
      ...dto,
      categoryIds: [categoryId],
      registrationDeadline: '2026-11-30T10:00:00.000Z',
      onlineUrl: 'https://example.com/meeting',
    };
    const draft = {
      ...event,
      onlineUrl: completeForm.onlineUrl,
      categories: [{ categoryId }],
    };
    const publishedResponse = {
      ...savedEvent,
      onlineUrl: completeForm.onlineUrl,
      categoryIds: [categoryId],
      status: 'PUBLISHED',
    };

    beforeEach(() => {
      vi.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-11-24T10:00:00Z').getTime(),
      );
      prisma.event.findFirst.mockResolvedValue(draft);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('creates the completed form directly as PUBLISHED in a single write', async () => {
      const published = { ...draft, status: 'PUBLISHED' };
      prisma.event.create.mockResolvedValue(published);
      expect(await service.publish('owner', completeForm)).toEqual(
        publishedResponse,
      );
      expect(prisma.event.create).toHaveBeenCalledExactlyOnceWith({
        include,
        data: expect.objectContaining({
          ...dto,
          onlineUrl: completeForm.onlineUrl,
          registrationDeadline: draft.registrationDeadline,
          categories: {
            create: [{ category: { connect: { id: categoryId } } }],
          },
          startDate: draft.startDate,
          endDate: draft.endDate,
          organizationId: 'organization',
          createdById: 'owner',
          status: 'PUBLISHED',
        }),
      });
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('requires an approved organization for direct publication', async () => {
      prisma.organization.findFirst.mockResolvedValue(null);
      await expect(
        service.publish('owner', completeForm),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('publishes the same saved draft and preserves its fields', async () => {
      const published = { ...draft, status: 'PUBLISHED' };
      prisma.event.update.mockResolvedValue(published);
      expect(await service.publishDraft('owner', 'event')).toEqual(
        publishedResponse,
      );
      expect(prisma.event.update).toHaveBeenCalledExactlyOnceWith({
        include,
        where: {
          id: 'event',
          createdById: 'owner',
          organization: { ownerId: 'owner', verificationStatus: 'APPROVED' },
          status: 'DRAFT',
          updatedAt: draft.updatedAt,
        },
        data: { status: 'PUBLISHED' },
      });
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it.each(['PENDING_REVIEW', 'PUBLISHED', 'FULL', 'CANCELLED', 'COMPLETED'])(
      'rejects publication of a %s event, including a repeated publish',
      async (status) => {
        prisma.event.findFirst.mockResolvedValue({ ...draft, status });
        await expect(
          service.publishDraft('owner', 'event'),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.event.update).not.toHaveBeenCalled();
      },
    );

    it.each([
      { title: ' ' },
      { description: '' },
      { format: 'IN_PERSON' },
      { format: 'HYBRID', location: ' ' },
      { onlineUrl: null },
      { onlineUrl: 'ftp://example.com/meeting' },
      { registrationMode: 'EXTERNAL', externalRegistrationUrl: null },
      { capacity: 0 },
      { startDate: '2026-11-24T10:00:00Z' },
      { endDate: dto.startDate },
      { registrationDeadline: '2026-12-02T10:00:00Z' },
    ])(
      'rejects incomplete or invalid data for both publish paths: %j',
      async (fields) => {
        const form = { ...completeForm, ...fields } as typeof completeForm;
        await expect(service.publish('owner', form)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        prisma.event.findFirst.mockResolvedValue({
          ...draft,
          ...form,
          startDate: new Date(form.startDate),
          endDate: new Date(form.endDate),
          registrationDeadline:
            'registrationDeadline' in fields
              ? new Date(fields.registrationDeadline!)
              : draft.registrationDeadline,
        });
        await expect(
          service.publishDraft('owner', 'event'),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.event.create).not.toHaveBeenCalled();
        expect(prisma.event.update).not.toHaveBeenCalled();
      },
    );

    it.each([
      { format: 'IN_PERSON', location: 'Main campus', onlineUrl: null },
      { format: 'HYBRID', location: 'Main campus' },
      {
        registrationMode: 'EXTERNAL',
        externalRegistrationUrl: 'https://example.com/register',
      },
    ])(
      'allows complete format and registration combinations: %j',
      async (fields) => {
        const form = { ...completeForm, ...fields } as typeof completeForm;
        prisma.event.create.mockResolvedValue({
          ...form,
          categories: [{ categoryId }],
          status: 'PUBLISHED',
        });
        await expect(service.publish('owner', form)).resolves.toMatchObject({
          status: 'PUBLISHED',
        });
      },
    );

    it.each([undefined, null])(
      'requires an explicit automatic deadline for both publish paths: %j',
      async (registrationDeadline) => {
        await expect(
          service.publish('owner', { ...completeForm, registrationDeadline }),
        ).rejects.toThrow(
          'registrationDeadline is required for automatic registration',
        );
        prisma.event.findFirst.mockResolvedValue({
          ...draft,
          registrationDeadline: registrationDeadline ?? null,
        });
        await expect(service.publishDraft('owner', 'event')).rejects.toThrow(
          'registrationDeadline is required for automatic registration',
        );
        expect(prisma.event.create).not.toHaveBeenCalled();
        expect(prisma.event.update).not.toHaveBeenCalled();
      },
    );

    it.each([undefined, []])(
      'requires request categories for direct publication: %j',
      async (categoryIds) => {
        await expect(
          service.publish('owner', { ...completeForm, categoryIds }),
        ).rejects.toThrow('categoryIds must contain at least one category');
        expect(prisma.event.create).not.toHaveBeenCalled();
      },
    );

    it('requires persisted category links for saved publication', async () => {
      prisma.event.findFirst.mockResolvedValue({ ...draft, categories: [] });
      await expect(service.publishDraft('owner', 'event')).rejects.toThrow(
        'categoryIds must contain at least one category',
      );
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown category on direct publication without creating a row', async () => {
      prisma.category.findMany.mockResolvedValue([]);
      await expect(service.publish('owner', completeForm)).rejects.toThrow(
        'categoryIds contains an unknown category',
      );
      expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('allows external publication without an automatic deadline on both paths', async () => {
      const fields = {
        registrationMode: 'EXTERNAL' as const,
        externalRegistrationUrl: 'https://example.com/register',
        registrationDeadline: null,
      };
      prisma.event.create.mockResolvedValue({
        ...draft,
        ...fields,
        status: 'PUBLISHED',
      });
      prisma.event.findFirst.mockResolvedValue({ ...draft, ...fields });
      prisma.event.update.mockResolvedValue({
        ...draft,
        ...fields,
        status: 'PUBLISHED',
      });
      await expect(
        service.publish('owner', { ...completeForm, ...fields }),
      ).resolves.toMatchObject({
        status: 'PUBLISHED',
        registrationDeadline: null,
      });
      await expect(
        service.publishDraft('owner', 'event'),
      ).resolves.toMatchObject({
        status: 'PUBLISHED',
        registrationDeadline: null,
      });
    });

    it('rejects a concurrent edit or publication without retrying or overwriting fields', async () => {
      prisma.event.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Draft changed', {
          code: 'P2025',
          clientVersion: '7.10.0',
        }),
      );
      await expect(
        service.publishDraft('owner', 'event'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.event.update).toHaveBeenCalledTimes(1);
      expect(prisma.event.create).not.toHaveBeenCalled();
    });
  });
});
