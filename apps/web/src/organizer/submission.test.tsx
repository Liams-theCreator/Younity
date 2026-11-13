import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { apiRequest } from '../api/client'
import { emptyDraft, type DraftValues } from './draft'
import { submissionErrors } from './submission'

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }))
const request = vi.mocked(apiRequest)
const draftPath = '/api/organizer-applications/draft'
const submitPath = '/api/organizer-applications/submit'
const nameLabel = 'Organization / University Entity Name'
const complete = {
  organizationName: 'Campus Club', type: 'STUDENT_CLUB',
  representativeFullName: 'Sara Test', academicPosition: 'Coordinator',
  phoneNumber: '+212612345678', proofUrl: null,
}
let draft: Record<keyof DraftValues, string | null>
let organizationStatus: string
let canEdit: boolean
let status: number
let readStatus: number
let responseBody: unknown
let offline: boolean
let gate: Promise<void> | null
const posts = () => request.mock.calls.filter(([url]) => url === submitPath)
const patches = () => request.mock.calls.filter(([url, options]) => url === draftPath && options?.method === 'PATCH')

beforeEach(() => {
  draft = { ...complete }
  organizationStatus = 'PENDING'
  canEdit = true
  status = 201
  readStatus = 200
  responseBody = { application: { id: 'application-1', status: 'PENDING' } }
  offline = false
  gate = null
  request.mockReset().mockImplementation(async (url, options) => {
    if (url === '/api/auth/me') return Response.json({
      id: 'organizer-1', email: 'organizer@example.test', role: 'ORGANIZER', status: 'PENDING',
      organization: { verificationStatus: organizationStatus },
    })
    if (url === draftPath) {
      if (readStatus !== 200) return new Response(null, { status: readStatus })
      if (options?.method === 'PATCH') draft = { ...draft, ...JSON.parse(String(options.body)) }
      return Response.json({ draft, canEdit })
    }
    if (url !== submitPath) throw new Error(`Unexpected request: ${String(url)}`)
    if (gate) await gate
    if (offline) throw new TypeError('Offline')
    if (status === 200 || status === 201) {
      organizationStatus = 'PENDING'
      canEdit = false
    }
    return Response.json(responseBody, { status })
  })
})

function mount() {
  return render(<MemoryRouter initialEntries={['/organizer/application']}><App /></MemoryRouter>)
}

async function load() {
  const view = mount()
  await screen.findByLabelText(nameLabel)
  return view
}

describe('organizer submission and corrections', () => {
  it.each([
    ['PENDING', 201, 'Submit application'],
    ['NEEDS_CHANGES', 200, 'Resubmit application'],
  ])('submits the saved %s application and refreshes the real session', async (initial, code, button) => {
    organizationStatus = initial
    status = code
    await load()
    await userEvent.click(screen.getByRole('button', { name: button }))
    expect(await screen.findByRole('heading', { name: 'Organization verification pending' })).toBeVisible()
    expect(posts()).toHaveLength(1)
    expect(posts()[0][1]).toEqual(expect.objectContaining({
      method: 'POST', credentials: 'include', cache: 'no-store',
    }))
    expect(posts()[0][1]?.body).toBeUndefined()
    expect(patches()).toHaveLength(0)
    expect(request.mock.calls.filter(([url]) => url === '/api/auth/me')).toHaveLength(2)
  })

  it('requires an explicit save before submitting edits, then submits only the saved draft', async () => {
    await load()
    fireEvent.change(screen.getByLabelText(nameLabel), { target: { value: 'Updated Club' } })
    expect(screen.getByRole('button', { name: 'Submit application' })).toBeDisabled()
    expect(posts()).toHaveLength(0)
    expect(patches()).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit application' })).toBeEnabled())
    expect(draft.organizationName).toBe('Updated Club')
    expect(posts()).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    await screen.findByRole('heading', { name: 'Organization verification pending' })
    expect(patches()).toHaveLength(1)
    expect(posts()).toHaveLength(1)
  })

  it.each([
    ['organizationName', nameLabel],
    ['type', 'Entity Category'],
    ['representativeFullName', 'Representative Full Name'],
    ['academicPosition', 'Title / Academic Position'],
    ['phoneNumber', 'Direct Contact Phone'],
  ] as const)('blocks submission with missing %s and focuses its associated error', async (field, label) => {
    draft[field] = null
    await load()
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    const input = screen.getByLabelText(label)
    expect(await screen.findByRole('alert')).toHaveTextContent('Complete the required information')
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Required before submitting your application.')
    expect(posts()).toHaveLength(0)
    expect(patches()).toHaveLength(0)
  })

  it.each([
    ['phoneNumber', 'not-a-phone', 'Direct Contact Phone'],
    ['proofUrl', 'ftp://example.test/evidence', 'Supporting link (optional)'],
  ] as const)('checks the format of saved %s before sending anything', async (field, value, label) => {
    draft[field] = value
    await load()
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.getByLabelText(label)).toHaveFocus()
    expect(posts()).toHaveLength(0)
  })

  it('locks both actions while submitting and navigates only after confirmed success', async () => {
    let release!: () => void
    gate = new Promise<void>((resolve) => { release = resolve })
    await load()
    const button = screen.getByRole('button', { name: 'Submit application' })
    await act(async () => { fireEvent.click(button); fireEvent.click(button) })
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(screen.getByLabelText(nameLabel)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    expect(button).toBeDisabled()
    expect(screen.queryByRole('heading', { name: 'Organization verification pending' })).not.toBeInTheDocument()
    release()
    expect(await screen.findByRole('heading', { name: 'Organization verification pending' })).toBeVisible()
    expect(posts()).toHaveLength(1)
  })

  it.each([400, 422])('keeps information after a validation rejection (%s)', async (code) => {
    status = code
    await load()
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not accepted')
    expect(screen.getByLabelText(nameLabel)).toHaveValue('Campus Club')
    expect(screen.getByRole('button', { name: 'Submit application' })).toBeEnabled()
    expect(screen.queryByRole('heading', { name: 'Organization verification pending' })).not.toBeInTheDocument()
    expect(posts()).toHaveLength(1)
  })

  it.each([403, 409, 503, 'offline', 'malformed'] as const)('requires a fresh read after an uncertain or stale result (%s)', async (failure) => {
    if (failure === 'offline') offline = true
    else if (failure === 'malformed') responseBody = { organization: { verificationStatus: 'PENDING' } }
    else status = failure
    await load()
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    expect(await screen.findByRole('alert')).toHaveFocus()
    expect(screen.getByLabelText(nameLabel)).toHaveValue('Campus Club')
    expect(screen.getByLabelText(nameLabel)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Submit application' })).toBeDisabled()
    expect(posts()).toHaveLength(1)
    canEdit = false
    await userEvent.click(screen.getByRole('button', { name: 'Reload application' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Submit application' })).not.toBeInTheDocument())
    expect(screen.getByLabelText(nameLabel)).toBeDisabled()
    expect(posts()).toHaveLength(1)
    expect(patches()).toHaveLength(0)
  })

  it.each([
    { application: { id: '', status: 'PENDING' } },
    { application: { id: 'application-1', status: 'APPROVED' } },
  ])('rejects an invalid confirmation without treating it as submission', async (body) => {
    responseBody = body
    await load()
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be confirmed')
    expect(screen.queryByRole('heading', { name: 'Organization verification pending' })).not.toBeInTheDocument()
  })

  it('keeps actions locked if reloading after a conflict also fails', async () => {
    status = 409
    await load()
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    await screen.findByRole('alert')
    readStatus = 503
    await userEvent.click(screen.getByRole('button', { name: 'Reload application' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
    expect(screen.getByLabelText(nameLabel)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Submit application' })).toBeDisabled()
    expect(posts()).toHaveLength(1)
    readStatus = 200
    canEdit = false
    await userEvent.click(screen.getByRole('button', { name: 'Reload application' }))
    await screen.findByText('Editing is not available for this application.')
    expect(posts()).toHaveLength(1)
  })

  it('offers session recovery instead of another submission if the post-submit session read fails', async () => {
    await load()
    request.mockResolvedValueOnce(Response.json(responseBody, { status: 201 }))
    request.mockResolvedValueOnce(new Response(null, { status: 503 }))
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not check your session')
    expect(screen.getByRole('button', { name: 'Retry session check' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Submit application' })).not.toBeInTheDocument()
    expect(posts()).toHaveLength(1)
  })

  it('uses the existing expired-session recovery on 401', async () => {
    status = 401
    await load()
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back to Younity' })).toBeVisible()
    expect(posts()).toHaveLength(1)
  })

  it('aborts waiting on unmount and ignores a late confirmation', async () => {
    let release!: () => void
    gate = new Promise<void>((resolve) => { release = resolve })
    const view = await load()
    await userEvent.click(screen.getByRole('button', { name: 'Submit application' }))
    const signal = posts()[0][1]?.signal
    view.unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => { release(); await gate })
    expect(request.mock.calls.filter(([url]) => url === '/api/auth/me')).toHaveLength(1)
  })

  it('keeps Enter as save-only instead of implicitly submitting an application', async () => {
    await load()
    const input = screen.getByLabelText(nameLabel)
    await userEvent.clear(input)
    await userEvent.type(input, 'Keyboard Club{Enter}')
    await screen.findByText('Draft saved.')
    expect(patches()).toHaveLength(1)
    expect(posts()).toHaveLength(0)
  })

  it('does not offer submission for a read-only application', async () => {
    canEdit = false
    await load()
    expect(screen.queryByRole('button', { name: 'Submit application' })).not.toBeInTheDocument()
    expect(posts()).toHaveLength(0)
  })

  it('validates all supplied values, including unchanged overlong text, without requiring a supporting link', () => {
    const values = { ...complete, proofUrl: '' }
    expect(submissionErrors(values)).toEqual({})
    expect(submissionErrors({ ...values, organizationName: 'x'.repeat(256) })).toHaveProperty('organizationName')
    expect(submissionErrors({ ...values, type: 'UNKNOWN' })).toHaveProperty('type')
    expect(Object.keys(submissionErrors(emptyDraft))).toHaveLength(5)
  })
})