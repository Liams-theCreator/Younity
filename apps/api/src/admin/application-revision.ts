import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

/** Aadel's resubmission transaction must call this alongside the submitted-data
 * writes. Never call separately or swallow its conflict: all writes must roll back.
 * Initial submission creates a PENDING application at revision 1; drafts must not
 * create PENDING application rows. Terminal applications cannot be resubmitted.
 */
export async function advanceApplicationRevision(
  tx: Prisma.TransactionClient,
  id: string,
  expectedRevision: number,
) {
  const result = await tx.organizationApplication.updateMany({
    where: {
      id,
      revision: expectedRevision,
      status: { in: ['PENDING', 'NEEDS_CHANGES'] },
    },
    data: {
      revision: { increment: 1 },
      status: 'PENDING',
      submittedAt: new Date(),
      reviewerId: null,
      reviewerNote: null,
      reviewedAt: null,
    },
  });
  if (result.count !== 1)
    throw new ConflictException('Application changed or cannot be resubmitted');
}
