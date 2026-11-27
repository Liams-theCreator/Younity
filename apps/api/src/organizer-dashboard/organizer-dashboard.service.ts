import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class OrganizerDashboardService {
  constructor(private readonly prisma: PrismaService) { }

  overview(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findFirst({
        where: { ownerId: userId, verificationStatus: 'APPROVED' },
        select: { orgName: true, owner: { select: { firstName: true } } },
      });
      if (!organization) throw new ForbiddenException('Approved organizer access required.');
      const owned = { createdById: userId, organization: { ownerId: userId, verificationStatus: 'APPROVED' as const } };
      const now = new Date();
      const active: Prisma.EventWhereInput = { ...owned, status: { in: ['PUBLISHED', 'FULL'] }, endDate: { gt: now } };
      const [activeEvents, confirmedBookings, draftCount, upcomingEvents, drafts, recentBookings, capacityEvents] = await Promise.all([
        tx.event.count({ where: active }),
        tx.eventRegistration.count({ where: { event: owned, status: 'CONFIRMED' } }),
        tx.event.count({ where: { ...owned, status: 'DRAFT' } }),
        tx.event.findMany({
          where: active,
          orderBy: [{ startDate: 'asc' }, { id: 'asc' }], take: 3,
          select: {
            id: true, title: true, startDate: true, endDate: true, format: true, location: true, imageUrl: true, capacity: true,
            _count: { select: { registrations: { where: { status: 'CONFIRMED' } } } }
          },
        }),
        tx.event.findMany({
          where: { ...owned, status: 'DRAFT' }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 3,
          select: { id: true, title: true, startDate: true, updatedAt: true, location: true, format: true },
        }),
        tx.eventRegistration.findMany({
          where: { event: owned, status: { in: ['CONFIRMED', 'CANCELLED'] } },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 5,
          select: { id: true, status: true, updatedAt: true, event: { select: { title: true } }, student: { select: { firstName: true, lastName: true } } },
        }),
        tx.event.findMany({
          where: { ...active, capacity: { not: null } },
          select: { capacity: true, _count: { select: { registrations: { where: { status: 'CONFIRMED' } } } } },
        }),
      ]);
      const capacity = capacityEvents.reduce((total, event) => total + (event.capacity ?? 0), 0);
      const booked = capacityEvents.reduce((total, event) => total + event._count.registrations, 0);
      return {
        organizationName: organization.orgName,
        organizerName: organization.owner.firstName,
        metrics: { activeEvents, confirmedBookings, draftCount, capacityUtilization: capacity ? Math.round(booked / capacity * 1000) / 10 : null },
        upcomingEvents: upcomingEvents.map(({ _count, ...event }) => ({ ...event, confirmedCount: _count.registrations })),
        drafts,
        recentBookings: recentBookings.map(booking => ({
          id: booking.id, participantName: `${booking.student.firstName} ${booking.student.lastName}`.trim(),
          eventTitle: booking.event.title, status: booking.status, updatedAt: booking.updatedAt,
        })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
