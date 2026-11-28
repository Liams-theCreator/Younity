import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { isUUID, validateSync } from 'class-validator';
import {
  EventFormat,
  EventStatus,
  Prisma,
  RegistrationMode,
  VerificationStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrganizerEventDto } from './dto/create-organizer-event.dto.js';
import { UpdateOrganizerEventDto } from './dto/update-organizer-event.dto.js';

@Injectable()
export class OrganizerEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async listDrafts(userId: string) {
    await this.approvedOrganization(userId);
    const drafts = await this.prisma.event.findMany({
      where: { ...this.ownedEvent(userId), status: EventStatus.DRAFT },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        updatedAt: true,
        startDate: true,
        format: true,
        location: true,
        imageUrl: true,
      },
    });
    return { drafts };
  }

  create(userId: string, dto: CreateOrganizerEventDto) {
    return this.createEvent(userId, dto, EventStatus.DRAFT);
  }

  async publish(userId: string, dto: CreateOrganizerEventDto) {
    this.validatePublication(dto);
    return this.createEvent(userId, dto, EventStatus.PUBLISHED);
  }

  async publishDraft(userId: string, id: string) {
    const event = await this.findOne(userId, id);

    if (event.status !== EventStatus.DRAFT) {
      throw new ConflictException('Only draft events can be published');
    }

    this.validatePublication({
      ...event,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      registrationDeadline: event.registrationDeadline?.toISOString() ?? null,
    });

    return this.updateDraft(userId, event, { status: EventStatus.PUBLISHED });
  }

  private async createEvent(
    userId: string,
    dto: CreateOrganizerEventDto,
    status: EventStatus,
  ) {
    const organization = await this.approvedOrganization(userId);
    const data = this.eventData(dto);
    this.validateDates(
      data.startDate!,
      data.endDate!,
      data.registrationDeadline,
    );

    const categoryIds = await this.validateCategoryIds(dto.categoryIds);
    const event = await this.prisma.event.create({
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
        status,
        categories: {
          create: (categoryIds ?? []).map((id) => ({
            category: { connect: { id } },
          })),
        },
      },
      include: { categories: { select: { categoryId: true } } },
    });
    return this.withCategoryIds(event);
  }

  async findOne(userId: string, id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, ...this.ownedEvent(userId) },
      include: { categories: { select: { categoryId: true } } },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.withCategoryIds(event);
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

    const categoryIds = await this.validateCategoryIds(dto.categoryIds);
    return this.updateDraft(userId, event, {
      ...data,
      ...(categoryIds === undefined
        ? {}
        : {
            // Relation-only writes do not advance Prisma's parent @updatedAt.
            // Always invalidate a competing read, even within one millisecond.
            updatedAt: new Date(
              Math.max(Date.now(), event.updatedAt.getTime() + 1),
            ),
            categories: {
              deleteMany: {},
              create: categoryIds.map((id) => ({
                category: { connect: { id } },
              })),
            },
          }),
    });
  }

  private async updateDraft(
    userId: string,
    event: { id: string; updatedAt: Date },
    data: Prisma.EventUpdateInput,
  ) {
    try {
      const saved = await this.prisma.event.update({
        where: {
          id: event.id,
          ...this.ownedEvent(userId),
          status: EventStatus.DRAFT,
          // Protect validation against concurrent changes to fields, links or status.
          updatedAt: event.updatedAt,
        },
        data,
        include: { categories: { select: { categoryId: true } } },
      });
      return this.withCategoryIds(saved);
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

  private validatePublication(dto: CreateOrganizerEventDto) {
    // Revalidate saved drafts too, including records created outside these routes.
    const errors = validateSync(plainToInstance(CreateOrganizerEventDto, dto));
    if (errors.length > 0) {
      throw new BadRequestException(
        errors.flatMap((error) => Object.values(error.constraints ?? {})),
      );
    }

    const startDate = new Date(dto.startDate);
    this.validateDates(
      startDate,
      new Date(dto.endDate),
      dto.registrationDeadline ? new Date(dto.registrationDeadline) : null,
    );
    if (startDate.getTime() <= Date.now()) {
      throw new BadRequestException(
        'startDate must be in the future to publish an event',
      );
    }
    if (
      (dto.format === EventFormat.IN_PERSON ||
        dto.format === EventFormat.HYBRID) &&
      !dto.location?.trim()
    ) {
      throw new BadRequestException(
        'location is required for in-person and hybrid events',
      );
    }
    if (
      (dto.format === EventFormat.ONLINE ||
        dto.format === EventFormat.HYBRID) &&
      !dto.onlineUrl
    ) {
      throw new BadRequestException(
        'onlineUrl is required for online and hybrid events',
      );
    }
    if (
      dto.registrationMode === RegistrationMode.AUTOMATIC &&
      !dto.registrationDeadline
    ) {
      throw new BadRequestException(
        'registrationDeadline is required for automatic registration',
      );
    }
    if (!dto.categoryIds?.length) {
      throw new BadRequestException(
        'categoryIds must contain at least one category to publish an event',
      );
    }
    if (
      dto.registrationMode === RegistrationMode.EXTERNAL &&
      !dto.externalRegistrationUrl
    ) {
      throw new BadRequestException(
        'externalRegistrationUrl is required for external registration',
      );
    }
  }

  private async validateCategoryIds(categoryIds?: string[]) {
    if (categoryIds === undefined) return undefined;
    if (
      !Array.isArray(categoryIds) ||
      categoryIds.some((id) => typeof id !== 'string' || !isUUID(id))
    ) {
      throw new BadRequestException(
        'categoryIds must be an array of valid UUIDs',
      );
    }
    const ids = categoryIds.map((id) => id.toLowerCase());
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('categoryIds must contain distinct UUIDs');
    }
    if (ids.length > 0) {
      const categories = await this.prisma.category.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      if (categories.length !== ids.length) {
        throw new BadRequestException(
          'categoryIds contains an unknown category',
        );
      }
    }
    return ids;
  }

  private withCategoryIds<T extends { categories: { categoryId: string }[] }>(
    event: T,
  ) {
    const { categories, ...fields } = event;
    return {
      ...fields,
      categoryIds: categories.map((link) => link.categoryId),
    };
  }

  private async approvedOrganization(userId: string) {
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
    return organization;
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
