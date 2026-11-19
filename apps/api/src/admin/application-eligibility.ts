import type { Prisma } from '../generated/prisma/client.js';

/** Matches S2-06's submitted-application read contract. Organization-only drafts
 * have no application row. Aadel must preserve that boundary on submission.
 */
export function submittedApplicationEligibility(
  now = new Date(),
): Prisma.OrganizationApplicationWhereInput {
  return {
    submittedAt: { lte: now },
    submittedBy: {
      role: 'ORGANIZER',
      status: { in: ['PENDING', 'ACTIVE'] },
      emailVerifiedAt: { not: null },
    },
    organization: {
      orgName: { not: '' },
      representativeFullName: { not: '' },
      academicPosition: { not: '' },
      phoneNumber: { not: '' },
    },
  };
}
