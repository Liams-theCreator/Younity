import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { apiRequest } from '../api/client'

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }))
const request = vi.mocked(apiRequest)
const baseUrl = process.env.ADMIN_REVIEW_TEST_BASE_URL
type Account = { id: string; email: string; password: string }
type Candidate = { id: string; name: string; owner: Account }
type Fixture = { admin: Account; otherAdmin: Account; student: Account; approve: Candidate; reject: Candidate; changes: Candidate; stale: Candidate; duplicate: Candidate; resubmitted: Candidate; unverified: Candidate; draft: Candidate }
const fixture = process.env.ADMIN_REVIEW_TEST_FIXTURE ? JSON.parse(process.env.ADMIN_REVIEW_TEST_FIXTURE) as Fixture : null
let cookie = ''
async function asAccount<T>(account: Account, action: () => Promise<T>) {
  const original = cookie
  try {
    await login(account)
    return await action()
  } finally { cookie = original }
}

// Only transport is replaced: every response comes from the actual Nest API,
// JWT authentication and PostgreSQL. No admin service or response is mocked.
async function realRequest(input: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  if (!baseUrl || new URL(baseUrl).hostname !== '127.0.0.1') throw new Error('Use the isolated localhost API runner')
  const headers = new Headers(options?.headers)
  if (cookie) headers.set('Cookie', cookie)
  const result = await fetch(new URL(String(input), baseUrl), { ...options, headers })
  const session = result.headers.get('set-cookie')
  if (session?.startsWith('access_token=')) cookie = session.split(';')[0]
  return result
}

async function login(account: Account) {
  cookie = ''
  const response = await realRequest('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password: account.password }) })
  expect(response.status).toBe(200)
  expect(cookie).toMatch(/^access_token=.+/)
}

function mount(path = '/admin/applications') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

beforeEach(async () => {
  cookie = ''
  request.mockReset().mockImplementation(realRequest)
  if (fixture) await login(fixture.admin)
})

describe.skipIf(!baseUrl || !fixture)('Admin screens against real HTTP APIs and PostgreSQL', () => {
  it('logs in through the real form and lists only eligible submissions', async () => {
    cookie = ''
    mount('/login')
    const interaction = userEvent.setup()
    await interaction.type(await screen.findByLabelText('Email Address'), fixture!.admin.email)
    await interaction.type(screen.getByLabelText('Password'), `${fixture!.admin.password}{Enter}`)
    expect(await screen.findByRole('link', { name: fixture!.approve.name }, { timeout: 10000 })).toBeVisible()
    expect(screen.queryByRole('link', { name: fixture!.unverified.name })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: fixture!.draft.name })).not.toBeInTheDocument()
  })

  it.each([
    ['approve', 'Approve', 'APPROVED', 'Approved'],
    ['reject', 'Reject', 'REJECTED', 'Rejected'],
    ['changes', 'Request changes', 'NEEDS_CHANGES', 'Changes requested'],
  ] as const)('saves %s using the actual decision endpoint, validates reasons, and refreshes detail/list', async (key, label, status, display) => {
    const candidate = fixture![key]
    mount(`/admin/applications/${candidate.id}?status=PENDING`)
    await userEvent.click(await screen.findByRole('radio', { name: label }))
    await userEvent.click(screen.getByRole('button', { name: `Confirm: ${label}` }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a decision reason')
    expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0)
    const reason = `Live ${key} evidence checked`
    await userEvent.type(screen.getByRole('textbox'), reason)
    await userEvent.click(screen.getByRole('button', { name: `Confirm: ${label}` }))
    expect(await screen.findByText(display, { exact: true }, { timeout: 10000 })).toBeVisible()
    expect(screen.getByText(reason)).toBeVisible()
    expect(screen.queryByRole('form', { name: 'Application decision' })).not.toBeInTheDocument()
    expect((await (await realRequest(`/api/admin/applications/${candidate.id}`)).json()).status).toBe(status)
    await userEvent.click(screen.getByRole('link', { name: 'Back to applications' }))
    await screen.findByRole('table')
    expect(screen.queryByRole('link', { name: candidate.name })).not.toBeInTheDocument()
  })

  it('refreshes a stale review after another real administrator decides', async () => {
    const candidate = fixture!.stale
    mount(`/admin/applications/${candidate.id}`)
    await screen.findByRole('form')
    const ownCookie = cookie
    await login(fixture!.otherAdmin)
    expect((await realRequest(`/api/admin/applications/${candidate.id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Other administrator reviewed first', expectedRevision: 1 }) })).status).toBe(201)
    cookie = ownCookie
    await userEvent.click(screen.getByRole('radio', { name: 'Approve' }))
    await userEvent.type(screen.getByRole('textbox'), 'My older review')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm: Approve' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('changed while you were reviewing')
    expect(await screen.findByText('Rejected', { exact: true })).toBeVisible()
    expect(screen.getByText('Other administrator reviewed first')).toBeVisible()
    const writes = request.mock.calls.filter(([, options]) => options?.method === 'POST')
    expect(writes).toHaveLength(1)
    expect(JSON.parse(writes[0][1]!.body as string).expectedRevision).toBe(1)
  })

  it('reviews an actual submitted application, keeps corrections private, and rejects its stale resubmitted revision', async () => {
    const candidate = fixture!.resubmitted
    mount(`/admin/applications/${candidate.id}`)
    await screen.findByText('Coordinator')
    await asAccount(fixture!.otherAdmin, async () => {
      expect((await realRequest(`/api/admin/applications/${candidate.id}/request-changes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Clarify your academic position', expectedRevision: 1 }) })).status).toBe(201)
    })
    await asAccount(candidate.owner, async () => {
      const saved = await realRequest('/api/organizer-applications/draft', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ academicPosition: 'Updated position after resubmission' }) })
      expect(saved.status).toBe(200)
      expect((await saved.json()).draft.academicPosition).toBe('Updated position after resubmission')
    })
    const privateRead = await (await realRequest(`/api/admin/applications/${candidate.id}/review`)).json()
    expect(privateRead.organization.academicPosition).toBe('Coordinator')
    expect(privateRead.revision).toBe(1)
    await asAccount(candidate.owner, async () => {
      const submitted = await realRequest('/api/organizer-applications/submit', { method: 'POST' })
      expect(submitted.status).toBe(201)
      expect(await submitted.json()).toEqual({ application: { id: candidate.id, status: 'PENDING' } })
      expect((await realRequest('/api/organizer-applications/submit', { method: 'POST' })).status).toBe(409)
    })
    await userEvent.click(screen.getByRole('radio', { name: 'Approve' }))
    await userEvent.type(screen.getByRole('textbox'), 'My older review')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm: Approve' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('changed while you were reviewing')
    await screen.findByText('Updated position after resubmission')
    expect(screen.getByRole('radio', { name: 'Approve' })).not.toBeChecked()
    expect(screen.getByRole('textbox')).toHaveValue('')
    let writes = request.mock.calls.filter(([, options]) => options?.method === 'POST')
    expect(writes).toHaveLength(1)
    expect(JSON.parse(writes[0][1]!.body as string).expectedRevision).toBe(1)
    expect(screen.getByText('Clarify your academic position')).toBeVisible()
    await userEvent.click(screen.getByRole('radio', { name: 'Approve' }))
    await userEvent.type(screen.getByRole('textbox'), 'Reviewed the revised information')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm: Approve' }))
    await screen.findByText('Approved', { exact: true })
    expect(screen.getByText('Reviewed the revised information')).toBeVisible()
    writes = request.mock.calls.filter(([, options]) => options?.method === 'POST')
    expect(writes).toHaveLength(2)
    expect(JSON.parse(writes[1][1]!.body as string).expectedRevision).toBe(2)
  })

  it('sends one write when submit events repeat before the real response is displayed', async () => {
    const candidate = fixture!.duplicate
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    request.mockImplementation(async (input, options) => {
      const response = await realRequest(input, options)
      if (options?.method === 'POST') await gate
      return response
    })
    mount(`/admin/applications/${candidate.id}`)
    await userEvent.click(await screen.findByRole('radio', { name: 'Approve' }))
    await userEvent.type(screen.getByRole('textbox'), 'One reviewed decision')
    fireEvent.submit(screen.getByRole('form'))
    fireEvent.submit(screen.getByRole('form'))
    await waitFor(() => expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Submitting decision…' })).toBeDisabled()
    await act(async () => { release() })
    expect(await screen.findByText('Approved', { exact: true })).toBeVisible()
  })

  it('handles a real backend permission denial after the browser session changes', async () => {
    mount()
    await screen.findByRole('table')
    await login(fixture!.student)
    await userEvent.click(screen.getByRole('button', { name: 'Refresh applications' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('do not have permission')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('blocks student navigation and ineligible application detail URLs', async () => {
    const first = mount(`/admin/applications/${fixture!.unverified.id}`)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be found')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    first.unmount()
    await login(fixture!.student)
    mount('/admin/applications')
    expect(await screen.findByRole('heading', { name: 'Student dashboard' })).toBeVisible()
    expect(within(screen.getByRole('main')).queryByRole('heading', { name: 'Application reviews' })).not.toBeInTheDocument()
  })
})
