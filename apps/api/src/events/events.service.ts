import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  EventStatus,
  Interests,
  RegistrationMode,
  RegistrationStatus,
  UserRole,
  UserStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DiscoveryQueryDto } from './discovery-query.dto.js';

const interestSlugs: Record<Interests, string> = {
  HACKATHONS: 'hackathons',
  AI_DATA: 'ai-data',
  STARTUPS_ENTR: 'startups-entrepreneurship',
  ROBOTICS_IOT: 'robotics-iot',
  UI_UX_DESIGN: 'ui-ux-design',
  PUBLIC_SPEAKING: 'public-speaking',
  SOCIAL_IMPACT_NGOS: 'social-impact-ngos',
  FINTECH: 'fintech',
  SCIENTIFIC_RESEARCH: 'scientific-research',
  CAREER_FAIRS_NETWORKING: 'career-fairs-networking',
};

const publicAfterEndMs = 24 * 60 * 60 * 1000;

function publicEvents(now: Date): Prisma.EventWhereInput {
  return {
    status: { in: [EventStatus.PUBLISHED, EventStatus.FULL] },
    endDate: { gte: new Date(now.getTime() - publicAfterEndMs) },
  };
}

const categoryFields = { id: true, name: true, slug: true } as const;
const summaryFields = {
  id: true,
  title: true,
  startDate: true,
  endDate: true,
  format: true,
  location: true,
  registrationMode: true,
  registrationDeadline: true,
  organization: { select: { id: true, orgName: true } },
  categories: {
    select: { category: { select: categoryFields } },
    orderBy: { category: { slug: 'asc' } },
  },
  status: true,
  capacity: true,
  _count: {
    select: {
      registrations: { where: { status: RegistrationStatus.CONFIRMED } },
    },
  },
} as const satisfies Prisma.EventSelect;

type SummaryRow = Prisma.EventGetPayload<{ select: typeof summaryFields }>;

function availability(event: SummaryRow, now: Date) {
  if (
    event.startDate <= now ||
    (event.registrationDeadline && event.registrationDeadline <= now) ||
    (event.registrationMode === RegistrationMode.AUTOMATIC &&
      !event.registrationDeadline)
  ) {
    return 'CLOSED';
  }
  if (
    event.status === EventStatus.FULL ||
    (event.capacity !== null && event._count.registrations >= event.capacity)
  ) {
    return 'FULL';
  }
  return 'OPEN';
}

function summary(event: SummaryRow, now: Date) {
  return {
    id: event.id,
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    format: event.format,
    location: event.location,
    categories: event.categories.map(({ category }) => category),
    organization: {
      id: event.organization.id,
      name: event.organization.orgName,
    },
    registrationMode: event.registrationMode,
    registrationDeadline: event.registrationDeadline,
    availability: availability(event, now),
  };
}

function contains(value: string): Prisma.StringFilter {
  // Prisma contains uses PostgreSQL LIKE patterns. Treat user input literally.
  return { contains: value.replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' };
}

function filters(query: DiscoveryQueryDto, now: Date): Prisma.EventWhereInput {
  const { q, category, city, format, from, to } = query;
  if (from && to && from > to) {
    throw new BadRequestException('from must be on or before to');
  }

  const endExclusive = to ? new Date(to) : undefined;
  if (endExclusive) endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const keyword = q ? contains(q) : undefined;
  return {
    ...publicEvents(now),
    format,
    categories: category
      ? { some: { category: { slug: category } } }
      : undefined,
    location: city ? contains(city) : undefined,
    startDate: { gte: from ? new Date(from) : undefined, lt: endExclusive },
    OR: keyword
      ? [
          { title: keyword },
          { description: keyword },
          { organization: { orgName: keyword } },
        ]
      : undefined,
  };
}

@Injectable()
export class EventsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: DiscoveryQueryDto, user?: AuthenticatedUser) {
    const now = new Date();
    const where = filters(query, now);
    const { page = 1, pageSize = 12 } = query;

    return this.prisma.$transaction(
      async (tx) => {
        const profile =
          user?.role === UserRole.STUDENT && user.status === UserStatus.ACTIVE
            ? await tx.studentProfile.findUnique({
                where: { userId: user.id },
                select: { interests: true },
              })
            : null;
        const slugs =
          profile?.interests.map((interest) => interestSlugs[interest]) ?? [];
        const categoryMatch = { category: { slug: { in: slugs } } };
        const interestGroups: Prisma.EventWhereInput[] = slugs.length
          ? [
              { categories: { some: categoryMatch } },
              { categories: { none: categoryMatch } },
            ]
          : [{}];
        const total = await tx.event.count({ where });
        const categories = await tx.category.findMany({
          select: categoryFields,
          orderBy: { name: 'asc' },
        });

        const items: SummaryRow[] = [];
        let skip = (page - 1) * pageSize;
        if (skip < total) {
          // Interest rank precedes date rank. Each event belongs to exactly one group.
          const groups = interestGroups.flatMap((interest) => [
            {
              where: { AND: [where, interest, { startDate: { gte: now } }] },
              direction: 'asc' as const,
            },
            {
              where: { AND: [where, interest, { startDate: { lt: now } }] },
              direction: 'desc' as const,
            },
          ]);
          for (const group of groups) {
            if (skip > 0) {
              const count = await tx.event.count({ where: group.where });
              if (skip >= count) {
                skip -= count;
                continue;
              }
            }
            items.push(
              ...(await tx.event.findMany({
                where: group.where,
                select: summaryFields,
                orderBy: [{ startDate: group.direction }, { id: 'asc' }],
                skip,
                take: pageSize - items.length,
              })),
            );
            skip = 0;
            if (items.length === pageSize) break;
          }
        }

        return {
          items: items.map((event) => summary(event, now)),
          categories,
          page,
          pageSize,
          total,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async detail(id: string) {
    const now = new Date();
    const event = await this.prisma.event.findFirst({
      where: { id, ...publicEvents(now) },
      select: {
        ...summaryFields,
        description: true,
        externalRegistrationUrl: true,
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    return {
      event: {
        ...summary(event, now),
        description: event.description,
        externalRegistrationUrl:
          event.registrationMode === RegistrationMode.EXTERNAL
            ? event.externalRegistrationUrl
            : null,
      },
    };
  }
}
