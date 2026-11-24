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
    event: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
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
  };

  beforeEach(() => {
    vi.resetAllMocks();
    service = new OrganizerEventsService(prisma as unknown as PrismaService);
    prisma.organization.findFirst.mockResolvedValue({ id: 'organization' });
    prisma.event.findFirst.mockResolvedValue(event);
  });

  it('persists a draft with server-derived owner and organization', async () => {
    prisma.event.create.mockResolvedValue(event);
    expect(await service.create('owner', dto)).toEqual(event);
    expect(prisma.organization.findFirst).toHaveBeenCalledWith({
      where: { ownerId: 'owner', verificationStatus: 'APPROVED' },
      select: { id: true },
    });
    expect(prisma.event.create).toHaveBeenCalledWith({
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

  it.each(['read', 'update'])(
    'returns 404 for a missing or another organizer’s event on %s',
    async (action) => {
      prisma.event.findFirst.mockResolvedValue(null);
      await expect(
        action === 'read'
          ? service.findOne('owner', 'event')
          : service.update('owner', 'event', { title: 'Changed' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.event.findFirst).toHaveBeenCalledWith({
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
    ).toEqual(saved);
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'event',
        createdById: 'owner',
        status: 'DRAFT',
        updatedAt: event.updatedAt,
      }),
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
});
