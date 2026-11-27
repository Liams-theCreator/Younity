import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  EventStatus,
  UserRole,
  UserStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListParticipantsDto } from './list-participants.dto.js';

const bookingSelect = { id: true, status: true } as const;
const publicEvent = {
  status: { in: [EventStatus.PUBLISHED, EventStatus.FULL] },
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async getOwnBooking(user: AuthenticatedUser, eventId: string) {
    await this.requireStudent(user);
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, ...publicEvent },
      select: {
        registrations: {
          where: {
            studentId: user.id,
            status: { in: ['CONFIRMED', 'CANCELLED'] },
          },
          select: bookingSelect,
        },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return { booking: event.registrations[0] ?? null };
  }

  async changeBooking(
    user: AuthenticatedUser,
    eventId: string,
    action: 'reserve' | 'cancel',
  ) {
    await this.requireStudent(user);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Serialize registration mutations and Event updates for this event.
          await tx.$queryRaw`SELECT id FROM events WHERE id = ${eventId}::uuid FOR UPDATE`;
          const event = await tx.event.findFirst({
            where: { id: eventId, ...publicEvent },
            select: {
              capacity: true,
              registrationMode: true,
              registrationDeadline: true,
              status: true,
            },
          });
          if (!event) throw new NotFoundException('Event not found');
          if (event.registrationMode !== 'AUTOMATIC') {
            throw new ConflictException('Event uses external registration');
          }
          if (
            !event.registrationDeadline ||
            event.registrationDeadline.getTime() <= Date.now()
          ) {
            throw new ConflictException('Registration is closed');
          }

          const where = { studentId_eventId: { studentId: user.id, eventId } };
          const existing = await tx.eventRegistration.findUnique({
            where,
            select: bookingSelect,
          });
          if (action === 'cancel') {
            if (!existing) throw new NotFoundException('Booking not found');
            if (existing.status !== 'CONFIRMED') {
              throw new ConflictException(
                'Only confirmed bookings can be cancelled',
              );
            }
            const booking = await tx.eventRegistration.update({
              where,
              data: { status: 'CANCELLED' },
              select: bookingSelect,
            });
            return { booking };
          }

          if (existing) throw new ConflictException('Booking already exists');
          if (
            event.status === 'FULL' ||
            (event.capacity !== null &&
              (await tx.eventRegistration.count({
                where: { eventId, status: 'CONFIRMED' },
              })) >= event.capacity)
          ) {
            throw new ConflictException('Event is full');
          }

          const booking = await tx.eventRegistration.create({
            data: { eventId, studentId: user.id, status: 'CONFIRMED' },
            select: bookingSelect,
          });
          return { booking };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException('Booking already exists');
        if (error.code === 'P2034') {
          throw new ConflictException(
            'Booking changed concurrently. Reload and try again',
          );
        }
      }
      throw error;
    }
  }

  async listParticipants(
    userId: string,
    { status, page, pageSize }: ListParticipantsDto,
  ) {
    const where = {
      status,
      event: {
        createdById: userId,
        organization: {
          ownerId: userId,
          verificationStatus: 'APPROVED' as const,
        },
      },
    };
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.eventRegistration.count({ where });
        if (page > Math.ceil(total / pageSize)) {
          return { items: [], page, pageSize, total };
        }
        const rows = await tx.eventRegistration.findMany({
          where,
          orderBy: [{ registeredAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            eventId: true,
            registeredAt: true,
            status: true,
            cancellationReason: true,
            event: { select: { title: true } },
            student: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        });
        const items = rows.map(({ event, student, ...row }) => ({
          ...row,
          eventTitle: event.title,
          participantName: [student.firstName, student.lastName]
            .join(' ')
            .trim(),
          email: student.email,
        }));
        return { items, page, pageSize, total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async requireStudent(user: AuthenticatedUser) {
    // RolesGuard also supports organizer fallback for shared onboarding routes.
    if (user.role !== UserRole.STUDENT || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException();
    }
    if (!(await this.auth.getStudentOnboarding(user.id)).complete) {
      throw new ForbiddenException(
        'Complete student onboarding before managing bookings',
      );
    }
  }
}
