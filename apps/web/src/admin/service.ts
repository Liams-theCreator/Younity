import type { OrganizationStatus } from '../auth/model'
import { isProofDocument } from '../organizer/proof'
import {
  ReviewError, statusLabels, decisionReasonLength,
  type ApplicationDetail, type ApplicationReviewService, type ApplicationSummary,
  type ReviewDetail, type ReviewRequestContext, type ReviewDecision, type ApplicationDecision,
} from './model'

const base = '/api/admin/applications'
const pageSize = 20
const statuses: OrganizationStatus[] = ['PENDING', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED']
const organizationTypes = ['UNIVERSITY', 'STUDENT_CLUB', 'NGO', 'ASSOCIATION', 'COMPANY', 'COMMUNITY', 'OTHER']
const decisions: ReviewDecision[] = ['approve', 'request-changes', 'reject']
// Published S2-09 contract, included in S2-03 PR #17 / d9db156.
export const decisionReasonLimit = 100

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ReviewError('unavailable')
  return value as Record<string, unknown>
}

function text(value: unknown, nonempty = true): string {
  if (typeof value !== 'string' || (nonempty && !value.trim())) throw new ReviewError('unavailable')
  return value
}

function date(value: unknown): string {
  const result = text(value)
  if (!Number.isFinite(Date.parse(result))) throw new ReviewError('unavailable')
  return result
}

function uuid(value: unknown): string {
  const result = text(value)
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(result)) throw new ReviewError('unavailable')
  return result
}

function revision(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 2147483647) throw new ReviewError('unavailable')
  return value as number
}

function summary(value: unknown): ApplicationSummary {
  const row = object(value)
  if (!statuses.includes(row.status as OrganizationStatus)) throw new ReviewError('unavailable')
  return {
    id: uuid(row.id), orgName: text(row.orgName), representativeFullName: text(row.representativeFullName),
    status: row.status as OrganizationStatus, submittedAt: date(row.submittedAt),
  }
}

function detail(value: unknown): ReviewDetail {
  const row = object(value)
  const organization = object(row.organization)
  const submittedBy = object(row.submittedBy)
  const type = text(organization.type)
  if (!organizationTypes.includes(type)) throw new ReviewError('unavailable')
  const proof = organization.proof
  if (proof != null && !isProofDocument(proof)) throw new ReviewError('unavailable')
  const application: ApplicationDetail = {
    ...summary({ ...row, orgName: organization.orgName, representativeFullName: organization.representativeFullName }),
    type, academicPosition: text(organization.academicPosition), phoneNumber: text(organization.phoneNumber),
    proofUrl: organization.proofUrl === null ? null : text(organization.proofUrl),
    ...(proof && { proof }),
    submittedBy: { firstName: text(submittedBy.firstName), lastName: text(submittedBy.lastName, false), email: text(submittedBy.email) },
    reviewerNote: row.reviewerNote === null ? null : text(row.reviewerNote, false),
    reviewedAt: row.reviewedAt === null ? null : date(row.reviewedAt),
  }
  const currentRevision = revision(row.revision)
  if (!Array.isArray(row.decisions)) throw new ReviewError('unavailable')
  const history: ApplicationDecision[] = row.decisions.map((value) => {
    const entry = object(value)
    const entryRevision = revision(entry.revision)
    if (entry.applicationId !== application.id || entry.oldStatus !== 'PENDING' ||
      !statuses.includes(entry.newStatus as OrganizationStatus) || entry.newStatus === 'PENDING' ||
      entryRevision > currentRevision) throw new ReviewError('unavailable')
    return {
      id: uuid(entry.id), revision: entryRevision, oldStatus: 'PENDING',
      newStatus: entry.newStatus as ApplicationDecision['newStatus'], reason: text(entry.reason), createdAt: date(entry.createdAt),
    }
  })
  if (new Set(history.map((entry) => entry.id)).size !== history.length ||
    new Set(history.map((entry) => entry.revision)).size !== history.length) throw new ReviewError('unavailable')
  return { application, revision: currentRevision, decisions: history, allowedDecisions: application.status === 'PENDING' ? [...decisions] : [] }
}

async function response(path: string, context: ReviewRequestContext, kind: 'list' | 'detail' | 'decision', options?: RequestInit) {
  context.signal.throwIfAborted()
  const result = await context.request(path, { ...options, credentials: 'include', cache: 'no-store', signal: context.signal })
  if (result.ok) return result
  if (result.status === 403) throw new ReviewError('forbidden')
  if (result.status === 404 && kind !== 'list') throw new ReviewError('not-found')
  if (result.status === 409 || result.status === 412) throw new ReviewError('conflict')
  if (result.status === 400 || result.status === 422) throw new ReviewError('validation')
  // requestProtected handles session expiry on 401. Never retry a decision here.
  throw new ReviewError('unavailable')
}

async function json(result: Response): Promise<unknown> {
  try { return await result.json() } catch { throw new ReviewError('unavailable') }
}

async function readDetail(id: string, context: ReviewRequestContext): Promise<ReviewDetail> {
  // Content, revision and history are read in one server snapshot. Do not pair
  // S2-06 content with a revision obtained by a separate request.
  const result = detail(await json(await response(`${base}/${encodeURIComponent(id)}/review`, context, 'detail')))
  if (result.application.id.toLowerCase() !== id.toLowerCase()) throw new ReviewError('unavailable')
  return result
}

export const adminReviewService: ApplicationReviewService = {
  filters: statuses.map((value) => ({ value, label: statusLabels[value] })),
  decisionRules: {
    approve: { reasonRequired: true, reasonMaxLength: decisionReasonLimit },
    'request-changes': { reasonRequired: true, reasonMaxLength: decisionReasonLimit },
    reject: { reasonRequired: true, reasonMaxLength: decisionReasonLimit },
  },
  async list(selection, context) {
    const page = selection.page === null ? 1 : Number(selection.page)
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000 ||
      (selection.page !== null && !/^[1-9]\d*$/.test(selection.page)) ||
      (selection.status !== null && !statuses.includes(selection.status))) throw new ReviewError('validation')
    const query = new URLSearchParams({ page: String(page), limit: String(pageSize) })
    if (selection.status !== null) query.set('status', selection.status)
    const data = object(await json(await response(`${base}?${query}`, context, 'list')))
    const { total, totalPages, limit } = data
    if (!Array.isArray(data.items) || data.page !== page || limit !== pageSize ||
      !Number.isSafeInteger(total) || (total as number) < 0 ||
      totalPages !== Math.ceil((total as number) / pageSize) || data.items.length > pageSize ||
      data.items.length > Math.max(0, (total as number) - (page - 1) * pageSize) ||
      data.hasNextPage !== (page * pageSize < (total as number)) || data.hasPreviousPage !== (page > 1)) throw new ReviewError('unavailable')
    const items = data.items.map(summary)
    if (new Set(items.map((item) => item.id)).size !== items.length) throw new ReviewError('unavailable')
    return {
      items, pageLabel: `Page ${page} of ${Math.max(1, totalPages as number)}`,
      previousPage: data.hasPreviousPage ? String(page - 1) : null,
      nextPage: data.hasNextPage ? String(page + 1) : null,
    }
  },
  detail: readDetail,
  async decide(current, input, context) {
    const reason = input.reason.trim()
    if (!decisions.includes(input.decision) || !reason || decisionReasonLength(reason) > decisionReasonLimit) throw new ReviewError('validation')
    const expectedRevision = revision(current.revision)
    if (current.application.status !== 'PENDING' || !current.allowedDecisions.includes(input.decision)) throw new ReviewError('conflict')
    // The server atomically checks the displayed revision and eligibility. A
    // 409 refreshes the screen; never fetch a newer revision to retry this POST.
    await response(`${base}/${encodeURIComponent(current.application.id)}/${input.decision}`, context, 'decision', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, expectedRevision }),
    })
    // A successful 2xx confirms persistence. The current response carries only
    // an update count, not application data. Reload the authoritative read API.
  },
}
