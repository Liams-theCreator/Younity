import type { OrganizationStatus } from '../auth/model'

// Normalized view models for S2-06 lists and S2-09 review snapshots/decisions.
export type ApplicationSummary = {
  id: string
  orgName: string
  representativeFullName: string
  status: OrganizationStatus
  submittedAt: string
}

export type ApplicationDetail = ApplicationSummary & {
  type: string
  academicPosition: string
  phoneNumber: string
  proofUrl: string | null
  submittedBy: { firstName: string; lastName: string; email: string }
  reviewerNote: string | null
  reviewedAt: string | null
}

// UI intents; the adapter adds the revision of the displayed review snapshot.
export type ReviewDecision = 'approve' | 'request-changes' | 'reject'
export type DecisionInput = { decision: ReviewDecision; reason: string }
export type DecisionRule = {
  reasonRequired: boolean
  reasonMaxLength?: number
}

// The published audit-table constraint limits the trimmed reason to 100 Unicode
// code points. This also satisfies the DTO's MaxLength validation.
export function decisionReasonLength(reason: string) {
  return Array.from(reason.trim()).length
}
export type ApplicationDecision = {
  id: string
  revision: number
  oldStatus: 'PENDING'
  newStatus: Exclude<OrganizationStatus, 'PENDING'>
  reason: string
  createdAt: string
}
export type ReviewDetail = {
  application: ApplicationDetail
  revision: number
  decisions: ApplicationDecision[]
  // The published decision API allows all three actions only for PENDING.
  allowedDecisions: ReviewDecision[]
}

export type ApplicationPage = {
  items: ApplicationSummary[]
  pageLabel: string
  previousPage: string | null
  nextPage: string | null
}

export type ListSelection = {
  status: OrganizationStatus | null
  // Normalized by the adapter into S2-06's positive integer page number.
  page: string | null
}

export type ReviewRequestContext = {
  signal: AbortSignal
  request: typeof fetch
}

export interface ApplicationReviewService {
  filters: { value: OrganizationStatus; label: string }[]
  decisionRules: Record<ReviewDecision, DecisionRule>
  list(selection: ListSelection, context: ReviewRequestContext): Promise<ApplicationPage>
  detail(id: string, context: ReviewRequestContext): Promise<ReviewDetail>
  // Send this displayed snapshot's revision; never silently use a newer one.
  decide(current: ReviewDetail, input: DecisionInput, context: ReviewRequestContext): Promise<void>
}

export class ReviewError extends Error {
  readonly kind: 'forbidden' | 'not-found' | 'conflict' | 'validation' | 'unavailable'

  constructor(kind: ReviewError['kind']) {
    const messages = {
      forbidden: 'You do not have permission to review applications.',
      'not-found': 'This application is unavailable or could not be found.',
      conflict: 'This application changed while you were reviewing it. Check the latest information before deciding again.',
      validation: 'The decision could not be accepted. Check the information and try again.',
      unavailable: 'Application reviews are temporarily unavailable. Please try again later.',
    }
    super(messages[kind])
    this.name = 'ReviewError'
    this.kind = kind
  }
}

export const statusLabels: Record<OrganizationStatus, string> = {
  PENDING: 'Pending review',
  NEEDS_CHANGES: 'Changes requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export const decisionLabels: Record<ReviewDecision, string> = {
  approve: 'Approve',
  'request-changes': 'Request changes',
  reject: 'Reject',
}
