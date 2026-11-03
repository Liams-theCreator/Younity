import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { apiRequest } from '../api/client'
import { ReviewError, type ApplicationReviewService, type ReviewDetail } from './model'

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }))
const request = vi.mocked(apiRequest)

// Fixtures exercise the frontend boundary only. These are not examples of
// the unconfirmed Sprint 02 API contract or eligibility/transition policy.
const initial: ReviewDetail = {
  application: {
    id: 'application-fixture',
    orgName: 'Campus Robotics Club',
    representativeFullName: 'Sara Example',
    status: 'PENDING',
    submittedAt: '2026-11-01T12:00:00Z',
    type: 'STUDENT_CLUB',
    academicPosition: 'Club coordinator',
    phoneNumber: '+212612345678',
    proofUrl: 'https://example.test/proof.pdf',
    submittedBy: { firstName: 'Sara', lastName: 'Example', email: 'sara@example.test' },
    reviewerNote: null,
    reviewedAt: null,
  },
  allowedDecisions: ['approve', 'request-changes', 'reject'],
}

function makeService() {
  return {
    filters: [{ value: 'PENDING' as const, label: 'Pending review' }, { value: 'APPROVED' as const, label: 'Approved' }],
    decisionRules: {
      approve: { reasonRequired: false },
      'request-changes': { reasonRequired: true, reasonMaxLength: 100 },
      reject: { reasonRequired: true, reasonMaxLength: 100 },
    },
    list: vi.fn<ApplicationReviewService['list']>().mockResolvedValue({
      items: [initial.application], pageLabel: 'Page 1', previousPage: null, nextPage: 'next-fixture',
    }),
    detail: vi.fn<ApplicationReviewService['detail']>().mockResolvedValue(initial),
    decide: vi.fn<ApplicationReviewService['decide']>().mockResolvedValue(undefined),
  } satisfies ApplicationReviewService
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

let session: { id: string; email: string; role: string; status: string; organization: { verificationStatus: string } | null } | null

function Location() {
  const location = useLocation()
  return <output aria-label="Current route">{location.pathname}{location.search}</output>
}

function mount(service?: ApplicationReviewService, path = '/admin/applications') {
  return render(<MemoryRouter initialEntries={[path]}><App reviewService={service} /><Location /></MemoryRouter>)
}

async function openDetail(service = makeService()) {
  mount(service, '/admin/applications/application-fixture')
  await screen.findByRole('heading', { name: initial.application.orgName })
  return service
}

beforeEach(() => {
  session = { id: 'admin-fixture', email: 'admin@example.test', role: 'ADMIN', status: 'ACTIVE', organization: null }
  request.mockReset().mockImplementation(async (input) => {
    if (input === '/api/auth/me') return session ? Response.json(session) : new Response(null, { status: 401 })
    throw new Error(`Unexpected request in frontend test: ${String(input)}`)
  })
})

describe('admin review access', () => {
  it.each(['/admin/applications', '/admin/applications/application-fixture'])('redirects an anonymous visit to %s before loading data', async (path) => {
    session = null
    const service = makeService()
    mount(service, path)
    await screen.findByLabelText('Email Address')
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login')
    expect(service.list).not.toHaveBeenCalled()
    expect(service.detail).not.toHaveBeenCalled()
  })

  it.each([
    ['STUDENT', 'ACTIVE', null],
    ['ORGANIZER', 'PENDING', 'PENDING'],
    ['ORGANIZER', 'ACTIVE', 'APPROVED'],
    ['ADMIN', 'SUSPENDED', null],
    ['ADMIN', 'PENDING', null],
  ])('blocks %s/%s from both review routes', async (role, status, verificationStatus) => {
    session = { ...session!, role: role!, status: status!, organization: verificationStatus ? { verificationStatus } : null }
    const service = makeService()
    const view = mount(service, '/admin/applications/application-fixture')
    await waitFor(() => expect(screen.queryByText('Checking your session…')).not.toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Application review' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Application reviews' })).not.toBeInTheDocument()
    view.unmount()
    mount(service)
    await waitFor(() => expect(screen.queryByText('Checking your session…')).not.toBeInTheDocument())
    expect(service.list).not.toHaveBeenCalled()
    expect(service.detail).not.toHaveBeenCalled()
  })

  it('waits for session restoration and provides admin navigation', async () => {
    const restore = deferred<Response>()
    request.mockReturnValueOnce(restore.promise)
    const service = makeService()
    mount(service)
    expect(screen.getByText('Checking your session…')).toHaveAttribute('role', 'status')
    expect(service.list).not.toHaveBeenCalled()
    await act(async () => { restore.resolve(Response.json(session)) })
    await screen.findByRole('heading', { name: 'Application reviews' })
    expect(within(screen.getByRole('navigation', { name: 'Account' })).getByRole('link', { name: 'Application reviews' })).toHaveAttribute('href', '/admin/applications')
  })

  it('shows unavailable without making up API requests when no adapter is configured', async () => {
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable')
    expect(request.mock.calls.every(([path]) => path === '/api/auth/me')).toBe(true)
    expect(screen.queryByRole('form', { name: 'Application decision' })).not.toBeInTheDocument()
  })
})

describe('application list', () => {
  it('shows loading, submitted metadata and bounded page navigation', async () => {
    const response = deferred<Awaited<ReturnType<ApplicationReviewService['list']>>>()
    const service = makeService()
    service.list.mockReturnValueOnce(response.promise)
    mount(service)
    expect(await screen.findByText('Loading applications…')).toBeInTheDocument()
    await act(async () => { response.resolve({ items: [initial.application], pageLabel: 'Page 1', previousPage: null, nextPage: 'next-fixture' }) })
    expect(await screen.findByRole('link', { name: initial.application.orgName })).toHaveAttribute('href', '/admin/applications/application-fixture')
    expect(screen.getByText('Sara Example')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(service.list).toHaveBeenLastCalledWith({ status: null, page: 'next-fixture' }, expect.anything()))
    expect(screen.getByLabelText('Current route')).toHaveTextContent('?page=next-fixture')
    expect(screen.getByRole('heading', { name: 'Application reviews' })).toHaveFocus()
  })

  it('uses only adapter filters and resets pagination when a filter changes', async () => {
    const service = makeService()
    mount(service, '/admin/applications?page=old-page')
    const filter = await screen.findByRole('combobox', { name: 'Review status' })
    expect(within(filter).queryByRole('option', { name: 'Rejected' })).not.toBeInTheDocument()
    await userEvent.selectOptions(filter, 'APPROVED')
    await waitFor(() => expect(service.list).toHaveBeenLastCalledWith({ status: 'APPROVED', page: null }, expect.anything()))
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/admin/applications?status=APPROVED')
  })

  it('shows an empty page without fixture data', async () => {
    const service = makeService()
    service.list.mockResolvedValue({ items: [], pageLabel: 'Page 1', previousPage: null, nextPage: null })
    mount(service)
    expect(await screen.findByText('No applications match this view.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: initial.application.orgName })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
  })

  it('supports retry after an unavailable response', async () => {
    const service = makeService()
    service.list.mockRejectedValueOnce(new Error('offline'))
    mount(service)
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: initial.application.orgName })).toBeInTheDocument()
  })

  it('clears previously displayed data when the backend denies a refresh', async () => {
    const service = makeService()
    mount(service)
    await screen.findByRole('link', { name: initial.application.orgName })
    service.list.mockRejectedValueOnce(new ReviewError('forbidden'))
    await userEvent.click(screen.getByRole('button', { name: 'Refresh applications' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission')
    expect(screen.queryByRole('link', { name: initial.application.orgName })).not.toBeInTheDocument()
  })
})

describe('application details and decisions', () => {
  it('shows submitted information, prior reasons and safe supporting links', async () => {
    const service = makeService()
    service.detail.mockResolvedValue({ application: { ...initial.application, reviewerNote: 'Please update the proof.\nUse the current document.' }, allowedDecisions: [] })
    await openDetail(service)
    expect(screen.getByText('sara@example.test')).toBeInTheDocument()
    expect(screen.getByText('Club coordinator')).toBeInTheDocument()
    expect(screen.getByText(/Please update the proof/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open supporting document/ })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('This application has no available review actions.')).toBeInTheDocument()
  })

  it.each(['javascript:alert(1)', 'data:text/html,unsafe', '/relative-unconfirmed-path'])('does not link unsafe or unconfirmed proof URL %s', async (proofUrl) => {
    const service = makeService()
    service.detail.mockResolvedValue({ ...initial, application: { ...initial.application, proofUrl } })
    await openDetail(service)
    expect(screen.queryByRole('link', { name: /Open supporting document/ })).not.toBeInTheDocument()
  })

  it.each(['not-found', 'forbidden'] as const)('handles a %s detail response without showing the form', async (kind) => {
    const service = makeService()
    service.detail.mockRejectedValue(new ReviewError(kind))
    mount(service, '/admin/applications/missing')
    expect(await screen.findByRole('alert')).toHaveTextContent(new ReviewError(kind).message)
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to applications' })).toBeInTheDocument()
  })

  it('validates decision choice and contract-provided reason rules with focus', async () => {
    const service = await openDetail()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm decision' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a decision')
    expect(screen.getByRole('radio', { name: 'Approve' })).toHaveFocus()
    await userEvent.click(screen.getByRole('radio', { name: 'Reject' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm: Reject' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a decision reason')
    expect(screen.getByRole('textbox', { name: 'Decision reason (required)' })).toHaveFocus()
    await userEvent.type(screen.getByRole('textbox'), 'x'.repeat(101))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm: Reject' }))
    expect(screen.getByRole('alert')).toHaveTextContent('at most 100 characters')
    expect(service.decide).not.toHaveBeenCalled()
  })

  it.each([
    ['request-changes', 'Request changes'], ['reject', 'Reject'],
  ] as const)('submits %s with a trimmed reason', async (decision, label) => {
    const service = await openDetail()
    await userEvent.click(screen.getByRole('radio', { name: label }))
    await userEvent.type(screen.getByRole('textbox'), '  Update the supporting document.  ')
    await userEvent.click(screen.getByRole('button', { name: `Confirm: ${label}` }))
    await waitFor(() => expect(service.decide).toHaveBeenCalledWith(initial, { decision, reason: 'Update the supporting document.' }, expect.anything()))
  })

  it('supports keyboard approval and locks repeated submissions until the refreshed state arrives', async () => {
    const service = await openDetail()
    const save = deferred<void>()
    const refresh = deferred<ReviewDetail>()
    service.decide.mockReturnValueOnce(save.promise)
    service.detail.mockReturnValueOnce(refresh.promise)
    const interaction = userEvent.setup()
    screen.getByRole('radio', { name: 'Approve' }).focus()
    await interaction.keyboard(' ')
    await interaction.tab()
    expect(screen.getByRole('textbox')).toHaveFocus()
    await interaction.tab()
    expect(screen.getByRole('button', { name: 'Confirm: Approve' })).toHaveFocus()
    await interaction.keyboard('{Enter}')
    fireEvent.submit(screen.getByRole('form'))
    fireEvent.submit(screen.getByRole('form'))
    expect(service.decide).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Submitting decision…' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Reject' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Refresh application' })).toBeDisabled()
    await act(async () => { save.resolve() })
    expect(await screen.findByText('Loading application…')).toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    await act(async () => { refresh.resolve({ application: { ...initial.application, status: 'APPROVED', reviewedAt: '2026-11-03T13:00:00Z' }, allowedDecisions: [] }) })
    expect(await screen.findByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Decision saved.')).toHaveAttribute('role', 'status')
  })

  it('reloads list state after returning from a successful decision and preserves filters', async () => {
    const service = makeService()
    mount(service, '/admin/applications?status=PENDING')
    await userEvent.click(await screen.findByRole('link', { name: initial.application.orgName }))
    await screen.findByRole('form')
    service.detail.mockResolvedValue({ application: { ...initial.application, status: 'APPROVED' }, allowedDecisions: [] })
    service.list.mockResolvedValue({ items: [], pageLabel: 'Page 1', previousPage: null, nextPage: null })
    await userEvent.click(screen.getByRole('radio', { name: 'Approve' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm: Approve' }))
    await screen.findByText('Approved')
    await userEvent.click(screen.getByRole('link', { name: 'Back to applications' }))
    expect(await screen.findByText('No applications match this view.')).toBeInTheDocument()
    expect(service.list).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('combobox')).toHaveValue('PENDING')
  })

  it.each([new ReviewError('conflict'), new Error('response lost after commit')])('refreshes a concurrent or uncertain decision before offering more actions: %s', async (cause) => {
    const service = await openDetail()
    service.decide.mockRejectedValueOnce(cause)
    service.detail.mockResolvedValue({ application: { ...initial.application, status: 'REJECTED', reviewerNote: 'Reviewed by another administrator' }, allowedDecisions: [] })
    await userEvent.click(screen.getByRole('radio', { name: 'Approve' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm: Approve' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(cause instanceof ReviewError ? 'changed while you were reviewing' : 'could not confirm')
    expect(await screen.findByText('Rejected')).toBeInTheDocument()
    expect(screen.getByText('Reviewed by another administrator')).toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(service.decide).toHaveBeenCalledTimes(1)
  })

  it('keeps actions hidden if refreshing after a conflict fails', async () => {
    const service = await openDetail()
    service.decide.mockRejectedValueOnce(new ReviewError('conflict'))
    service.detail.mockRejectedValueOnce(new Error('offline'))
    await userEvent.click(screen.getByRole('radio', { name: 'Approve' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm: Approve' }))
    await screen.findByRole('button', { name: 'Try again' })
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('form')).toBeInTheDocument()
    expect(service.detail).toHaveBeenCalledTimes(3)
  })

  it('removes submitted information after a decision permission denial', async () => {
    const service = await openDetail()
    service.decide.mockRejectedValueOnce(new ReviewError('forbidden'))
    await userEvent.click(screen.getByRole('radio', { name: 'Approve' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirm: Approve' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.queryByText('sara@example.test')).not.toBeInTheDocument()
  })

  it('uses the protected request boundary so an API 401 expires the session', async () => {
    const service = makeService()
    service.detail.mockImplementation(async (_id, { request: protectedRequest }) => {
      // Test-only URL: deliberately not an invented production endpoint.
      await protectedRequest('/test-only/read', { method: 'GET' })
      throw new ReviewError('unavailable')
    })
    request.mockImplementation(async (input) => input === '/api/auth/me' ? Response.json(session) : new Response(null, { status: 401 }))
    mount(service, '/admin/applications/application-fixture')
    expect(await screen.findByText('Your session expired. Please sign in again.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Application review' })).not.toBeInTheDocument()
  })

  it('aborts a pending read and ignores its response after leaving details', async () => {
    const service = makeService()
    const response = deferred<ReviewDetail>()
    service.detail.mockReturnValueOnce(response.promise)
    mount(service, '/admin/applications/application-fixture')
    await screen.findByText('Loading application…')
    const signal = service.detail.mock.calls[0][1].signal
    await userEvent.click(screen.getByRole('link', { name: 'Back to applications' }))
    await screen.findByRole('heading', { name: 'Application reviews' })
    expect(signal.aborted).toBe(true)
    await act(async () => { response.resolve(initial) })
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })
})
