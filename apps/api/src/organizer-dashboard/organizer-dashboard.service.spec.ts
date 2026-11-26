import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizerDashboardService } from './organizer-dashboard.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function database() {
  const tx = {
    organization: { findFirst: vi.fn().mockResolvedValue({ orgName: 'Campus club', owner: { firstName: 'Sara' } }) },
    event: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    eventRegistration: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
  };
  const prisma = { $transaction: vi.fn(async (read: (client: typeof tx) => Promise<unknown>) => read(tx)) };
  return { tx, prisma, service: new OrganizerDashboardService(prisma as unknown as PrismaService) };
}
let db: ReturnType<typeof database>;
beforeEach(() => { db = database(); });

describe('organizer dashboard snapshot', () => {
  it('returns empty counts and an unknown utilization for an organization without events', async () => {
    const result = await db.service.overview('owner');
    expect(result).toMatchObject({ organizationName: 'Campus club', organizerName: 'Sara', metrics: { activeEvents: 0, confirmedBookings: 0, draftCount: 0, capacityUtilization: null }, upcomingEvents: [], drafts: [], recentBookings: [] });
    expect(db.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
  });
  it('scopes every event/participant read to the approved session owner', async () => {
    await db.service.overview('owner');
    for (const [query] of [...db.tx.event.count.mock.calls, ...db.tx.event.findMany.mock.calls]) {
      expect(query.where).toMatchObject({ createdById: 'owner', organization: { ownerId: 'owner', verificationStatus: 'APPROVED' } });
    }
    for (const [query] of [...db.tx.eventRegistration.count.mock.calls, ...db.tx.eventRegistration.findMany.mock.calls]) {
      expect(query.where.event).toMatchObject({ createdById: 'owner', organization: { ownerId: 'owner', verificationStatus: 'APPROVED' } });
    }
  });
  it('calculates utilization from capped active events and maps recent activity', async () => {
    db.tx.event.count.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    db.tx.eventRegistration.count.mockResolvedValue(15);
    db.tx.event.findMany.mockResolvedValueOnce([{ id: 'event', title: 'Talk', _count: { registrations: 8 } }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ capacity: 10, _count: { registrations: 8 } }, { capacity: 20, _count: { registrations: 7 } }]);
    const date = new Date();
    db.tx.eventRegistration.findMany.mockResolvedValue([{ id: 'booking', status: 'CANCELLED', updatedAt: date, student: { firstName: 'Sara', lastName: 'Example' }, event: { title: 'Talk' } }]);
    const result = await db.service.overview('owner');
    expect(result.metrics).toEqual({ activeEvents: 2, confirmedBookings: 15, draftCount: 3, capacityUtilization: 50 });
    expect(result.upcomingEvents).toEqual([{ id: 'event', title: 'Talk', confirmedCount: 8 }]);
    expect(result.recentBookings).toEqual([{ id: 'booking', participantName: 'Sara Example', eventTitle: 'Talk', status: 'CANCELLED', updatedAt: date }]);
  });
  it('denies a revoked approval before reading event or attendee data', async () => {
    db.tx.organization.findFirst.mockResolvedValue(null);
    await expect(db.service.overview('owner')).rejects.toMatchObject({ status: 403 });
    expect(db.tx.event.findMany).not.toHaveBeenCalled();
    expect(db.tx.eventRegistration.findMany).not.toHaveBeenCalled();
  });
});
