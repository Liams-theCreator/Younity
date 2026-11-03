import type { OrganizationStatus } from '../auth/model'

// Frontend view models, not an S2-06/S2-09 wire contract. Field names come
// from the current Prisma schema. The API adapter must explicitly select
// safe fields and enforce the agreed submitted/verified eligibility rules.
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

// These are UI intents; the future adapter translates them into the agreed
// method/path/body and concurrency precondition. They are never sent as-is.
export type ReviewDecision = 'approve' | 'request-changes' | 'reject'
export type DecisionInput = { decision: ReviewDecision; reason: string }
export type DecisionRule = {
  reasonRequired: boolean
  reasonMaxLength?: number
}
export type ReviewDetail = {
  application: ApplicationDetail
  // Supplied by the adapter using the agreed transition rules, not inferred
  // from organization verification status by the UI.
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
  // Opaque frontend navigation value, normalized by the adapter. This does
  // not prescribe cursor- or offset-based pagination for the backend.
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
  // The adapter must preserve the server's concurrency precondition for
  // this exact detail snapshot, and normalize documented API errors.
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
