import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EventStatus,
  Prisma,
  VerificationStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrganizerEventDto } from './dto/create-organizer-event.dto.js';
import { UpdateOrganizerEventDto } from './dto/update-organizer-event.dto.js';

@Injectable()
export class OrganizerEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrganizerEventDto) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        ownerId: userId,
        verificationStatus: VerificationStatus.APPROVED,
      },
      select: { id: true },
    });

    if (!organization) {
      throw new ForbiddenException('An approved organization is required');
    }

    const data = this.eventData(dto);
    this.validateDates(
      data.startDate!,
      data.endDate!,
      data.registrationDeadline,
    );

    return this.prisma.event.create({
      data: {
        ...data,
        title: dto.title,
        description: dto.description,
        format: dto.format,
        startDate: data.startDate!,
        endDate: data.endDate!,
        registrationMode: dto.registrationMode,
        organizationId: organization.id,
        createdById: userId,
        status: EventStatus.DRAFT,
      },
    });
  }

  async findOne(userId: string, id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, ...this.ownedEvent(userId) },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  async update(userId: string, id: string, dto: UpdateOrganizerEventDto) {
    const event = await this.findOne(userId, id);

    if (event.status !== EventStatus.DRAFT) {
      throw new ConflictException('Only draft events can be edited');
    }

    const data = this.eventData(dto);
    this.validateDates(
      data.startDate ?? event.startDate,
      data.endDate ?? event.endDate,
      data.registrationDeadline !== undefined
        ? data.registrationDeadline
        : event.registrationDeadline,
    );

    try {
      return await this.prisma.event.update({
        where: {
          id,
          ...this.ownedEvent(userId),
          status: EventStatus.DRAFT,
          // Protect validation against concurrent changes to saved dates or status.
          updatedAt: event.updatedAt,
        },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ConflictException(
          'Event changed; reload it before saving again',
        );
      }
      throw error;
    }
  }

  private ownedEvent(userId: string) {
    return {
      createdById: userId,
      organization: {
        ownerId: userId,
        verificationStatus: VerificationStatus.APPROVED,
      },
    };
  }

  private eventData(dto: UpdateOrganizerEventDto) {
    // Explicit fields prevent clients from setting ownership or publication status.
    return {
      title: dto.title,
      description: dto.description,
      format: dto.format,
      location: dto.location,
      onlineUrl: dto.onlineUrl,
      imageUrl: dto.imageUrl,
      startDate:
        dto.startDate === undefined ? undefined : new Date(dto.startDate),
      endDate: dto.endDate === undefined ? undefined : new Date(dto.endDate),
      registrationDeadline:
        dto.registrationDeadline === undefined
          ? undefined
          : dto.registrationDeadline === null
            ? null
            : new Date(dto.registrationDeadline),
      capacity: dto.capacity,
      registrationMode: dto.registrationMode,
      externalRegistrationUrl: dto.externalRegistrationUrl,
    };
  }

  private validateDates(
    startDate: Date,
    endDate: Date,
    deadline?: Date | null,
  ) {
    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }
    if (deadline && deadline > startDate) {
      throw new BadRequestException(
        'registrationDeadline must not be after startDate',
      );
    }
  }
}
