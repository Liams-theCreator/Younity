import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminReviewService as service } from './service'
import { ReviewError, type ReviewRequestContext } from './model'

const id = '11111111-1111-4111-8111-111111111111'
const application = {
  id, orgName: 'Campus Club', representativeFullName: 'Sara Example', status: 'PENDING',
  submittedAt: '2026-11-01T12:00:00.000Z', type: 'STUDENT_CLUB', academicPosition: 'Coordinator',
  phoneNumber: '+212612345678', proofUrl: null, submittedBy: { firstName: 'Sara', lastName: 'Example', email: 'sara@example.test' },
  reviewerNote: null, reviewedAt: null,
}
const review = {
  id, status: application.status, submittedAt: application.submittedAt, reviewerNote: null, reviewedAt: null,
  revision: 2, decisions: [], submittedBy: application.submittedBy,
  organization: { orgName: application.orgName, representativeFullName: application.representativeFullName,
    type: application.type, academicPosition: application.academicPosition, phoneNumber: application.phoneNumber, proofUrl: null },
}
const history = { id: '22222222-2222-4222-8222-222222222222', applicationId: id, revision: 1, oldStatus: 'PENDING', newStatus: 'NEEDS_CHANGES', reason: 'Please update your document.', createdAt: '2026-10-31T12:00:00.000Z' }
const page = { items: [application], total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false }
let context: ReviewRequestContext
const request = vi.fn<typeof fetch>()

beforeEach(() => {
  context = { request, signal: new AbortController().signal }
  request.mockReset()
})

describe('real admin review adapter', () => {
  it('maps S2-06 pagination and selects safe summary fields', async () => {
    request.mockResolvedValue(Response.json(page))
    const result = await service.list({ page: null, status: null }, context)
    expect(request).toHaveBeenCalledWith('/api/admin/applications?page=1&limit=20', expect.objectContaining({ credentials: 'include', cache: 'no-store', signal: context.signal }))
    expect(result).toEqual({ items: [{ id, orgName: 'Campus Club', representativeFullName: 'Sara Example', status: 'PENDING', submittedAt: application.submittedAt }], pageLabel: 'Page 1 of 1', previousPage: null, nextPage: null })
  })

  it('maps next/previous pages and passes the selected status', async () => {
    request.mockResolvedValue(Response.json({ ...page, page: 2, total: 42, totalPages: 3, hasNextPage: true, hasPreviousPage: true }))
    expect(await service.list({ page: '2', status: 'PENDING' }, context)).toMatchObject({ pageLabel: 'Page 2 of 3', previousPage: '1', nextPage: '3' })
    expect(request.mock.calls[0][0]).toBe('/api/admin/applications?page=2&limit=20&status=PENDING')
  })

  it.each(['0', '-1', '1.5', '1e3', '1000001', 'bad'])('rejects malformed page %s without requesting data', async (value) => {
    await expect(service.list({ page: value, status: null }, context)).rejects.toMatchObject({ kind: 'validation' })
    expect(request).not.toHaveBeenCalled()
  })

  it.each([
    { ...page, total: '1' }, { ...page, totalPages: 5 }, { ...page, hasNextPage: true },
    { ...page, items: [{ ...application, status: 'DRAFT' }] },
    { ...page, items: [{ ...application, submittedAt: 'invalid' }] },
    { ...page, total: 2, items: [application, application] },
  ])('rejects malformed or inconsistent list responses: %j', async (data) => {
    request.mockResolvedValue(Response.json(data))
    await expect(service.list({ page: null, status: null }, context)).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('returns an empty page without fabricating records', async () => {
    request.mockResolvedValue(Response.json({ ...page, items: [], total: 0, totalPages: 0 }))
    expect(await service.list({ page: null, status: null }, context)).toMatchObject({ items: [], previousPage: null, nextPage: null })
  })

  it('obtains content, revision and safe history from a single review snapshot', async () => {
    request.mockResolvedValueOnce(Response.json({ ...review, decisions: [history], passwordHash: 'private', submittedBy: { ...review.submittedBy, token: 'private' } }))
    const result = await service.detail(id, context)
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith(`/api/admin/applications/${id}/review`, expect.objectContaining({ cache: 'no-store', signal: context.signal }))
    expect(result.application).toEqual(application)
    expect(result.revision).toBe(2)
    expect(result.decisions).toEqual([{ id: history.id, revision: 1, oldStatus: 'PENDING', newStatus: 'NEEDS_CHANGES', reason: history.reason, createdAt: history.createdAt }])
    expect(result.allowedDecisions).toEqual(['approve', 'request-changes', 'reject'])
    expect(JSON.stringify(result)).not.toContain('private')
    request.mockResolvedValueOnce(Response.json({ ...review, status: 'APPROVED' }))
    expect((await service.detail(id, context)).allowedDecisions).toEqual([])
  })

  it.each([undefined, null, '2', 0, -1, 1.5, 2147483648])('rejects missing or invalid snapshot revision %s', async (revision) => {
    request.mockResolvedValue(Response.json({ ...review, revision }))
    await expect(service.detail(id, context)).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it.each([
    { ...review, decisions: null }, { ...review, organization: null },
    { ...review, decisions: [{ ...history, revision: 3 }] },
    { ...review, decisions: [{ ...history, applicationId: history.id }] },
    { ...review, decisions: [{ ...history, newStatus: 'PENDING' }] },
    { ...review, decisions: [history, history] },
  ])('rejects incomplete or inconsistent review snapshots', async (data) => {
    request.mockResolvedValue(Response.json(data))
    await expect(service.detail(id, context)).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it.each(['approve', 'request-changes', 'reject'] as const)('sends %s with a trimmed reason and the displayed expectedRevision', async (decision) => {
    request.mockResolvedValueOnce(Response.json(review))
    const current = await service.detail(id, context)
    request.mockReset().mockResolvedValueOnce(new Response('1', { status: 201 }))
    await service.decide(current, { decision, reason: '  Reviewed document  ' }, context)
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith(`/api/admin/applications/${id}/${decision}`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: 'Reviewed document', expectedRevision: 2 }) }))
    expect(service.decisionRules[decision]).toEqual({ reasonRequired: true, reasonMaxLength: 100 })
    request.mockClear()
    for (const reason of ['  ', 'x'.repeat(101)]) await expect(service.decide(current, { decision, reason }, context)).rejects.toMatchObject({ kind: 'validation' })
    expect(request).not.toHaveBeenCalled()
  })

  it('preserves the displayed revision on conflict without fetching/retrying a newer revision', async () => {
    request.mockResolvedValueOnce(Response.json(review))
    const current = await service.detail(id, context)
    request.mockReset().mockResolvedValueOnce(new Response(null, { status: 409 }))
    await expect(service.decide(current, { decision: 'approve', reason: 'Old review' }, context)).rejects.toMatchObject({ kind: 'conflict' })
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][1]?.body).toBe(JSON.stringify({ reason: 'Old review', expectedRevision: 2 }))
  })

  it('does not write a closed snapshot or an invalid revision', async () => {
    request.mockResolvedValueOnce(Response.json({ ...review, status: 'REJECTED' }))
    const current = await service.detail(id, context)
    request.mockClear()
    await expect(service.decide(current, { decision: 'approve', reason: 'Reviewed' }, context)).rejects.toMatchObject({ kind: 'conflict' })
    await expect(service.decide({ ...current, revision: 0 }, { decision: 'approve', reason: 'Reviewed' }, context)).rejects.toMatchObject({ kind: 'unavailable' })
    expect(request).not.toHaveBeenCalled()
  })

  it('uses the persisted Unicode length limit for reasons', async () => {
    request.mockResolvedValueOnce(Response.json(review))
    const current = await service.detail(id, context)
    for (const reason of ['🙂'.repeat(100), '✅️'.repeat(50)]) {
      request.mockReset().mockResolvedValueOnce(new Response('1', { status: 201 }))
      await service.decide(current, { decision: 'approve', reason }, context)
      expect(request).toHaveBeenCalledTimes(1)
    }
    request.mockClear()
    await expect(service.decide(current, { decision: 'approve', reason: '✅️'.repeat(51) }, context)).rejects.toMatchObject({ kind: 'validation' })
    expect(request).not.toHaveBeenCalled()
  })

  it.each([[400, 'validation'], [401, 'unavailable'], [403, 'forbidden'], [404, 'not-found'], [409, 'conflict'], [500, 'unavailable']] as const)('maps HTTP %s and never retries the POST', async (status, kind) => {
    request.mockResolvedValueOnce(Response.json(review))
    const current = await service.detail(id, context)
    request.mockReset().mockResolvedValueOnce(new Response(null, { status }))
    await expect(service.decide(current, { decision: 'approve', reason: 'Reviewed' }, context)).rejects.toMatchObject({ kind })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not repeat an uncertain write after a lost response', async () => {
    request.mockResolvedValueOnce(Response.json(review))
    const current = await service.detail(id, context)
    request.mockReset().mockRejectedValueOnce(new TypeError('connection lost'))
    await expect(service.decide(current, { decision: 'reject', reason: 'Reviewed' }, context)).rejects.toThrow('connection lost')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('rejects mismatched detail IDs and malformed JSON', async () => {
    request.mockResolvedValueOnce(Response.json({ ...review, id: history.id }))
    await expect(service.detail(id, context)).rejects.toBeInstanceOf(ReviewError)
    request.mockResolvedValueOnce(new Response('invalid JSON'))
    await expect(service.detail(id, context)).rejects.toMatchObject({ kind: 'unavailable' })
  })
})
