import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { apiRequest } from '../api/client'

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }))
const request = vi.mocked(apiRequest)
const endpoint = '/api/organizer-applications/draft'
const nameLabel = 'Organization / University Entity Name'

type Draft = {
  organizationName: string | null
  type: string | null
  representativeFullName: string | null
  academicPosition: string | null
  phoneNumber: string | null
  proofUrl: string | null
}

const empty: Draft = {
  organizationName: null,
  type: null,
  representativeFullName: null,
  academicPosition: null,
  phoneNumber: null,
  proofUrl: null,
}
const saved: Draft = {
  organizationName: 'Campus Club',
  type: 'STUDENT_CLUB',
  representativeFullName: 'Sara Test',
  academicPosition: 'Coordinator',
  phoneNumber: '+212612345678',
  proofUrl: 'https://example.test/club',
}

let draft: Draft | null
let canEdit: boolean
let readStatus: number
let saveStatus: number
let readError: boolean
let readBody: unknown
let readGate: Promise<void> | null
let saveGate: Promise<void> | null
let role: string
let organizationStatus: string

const reads = () => request.mock.calls.filter(([url, options]) => url === endpoint && options?.method !== 'PATCH')
const patches = () => request.mock.calls.filter(([url, options]) => url === endpoint && options?.method === 'PATCH')

beforeEach(() => {
  draft = structuredClone(saved)
  canEdit = true
  readStatus = 200
  saveStatus = 200
  readError = false
  readBody = undefined
  readGate = null
  saveGate = null
  role = 'ORGANIZER'
  organizationStatus = 'PENDING'
  request.mockReset().mockImplementation(async (url, options) => {
    if (url === '/api/auth/me') {
      return Response.json({
        id: 'organizer', email: 'organizer@example.test', role,
        status: role === 'STUDENT' || organizationStatus === 'APPROVED' ? 'ACTIVE' : 'PENDING',
        organization: role === 'ORGANIZER' ? { verificationStatus: organizationStatus } : null,
      })
    }
    if (url !== endpoint) throw new Error(`Unexpected request: ${String(url)}`)
    if (options?.method === 'PATCH') {
      if (saveGate) await saveGate
      if (saveStatus !== 200) return new Response(null, { status: saveStatus })
      const changes = JSON.parse(String(options.body)) as Partial<Draft>
      draft = { ...(draft ?? empty), ...changes }
      return Response.json({ draft, canEdit })
    }
    if (readGate) await readGate
    if (readError) throw new TypeError('Offline')
    if (readStatus !== 200) return new Response(null, { status: readStatus })
    return Response.json(readBody === undefined ? { draft, canEdit } : readBody)
  })
})

function mount() {
  return render(<MemoryRouter initialEntries={['/organizer/application']}><App /></MemoryRouter>)
}

async function loaded() {
  mount()
  return screen.findByLabelText(nameLabel)
}

describe('organizer draft frontend integration', () => {
  it('restores saved fields using the session cookie without exposing account fields', async () => {
    expect(await loaded()).toHaveValue('Campus Club')
    expect(screen.getByLabelText('Entity Category')).toHaveValue('STUDENT_CLUB')
    expect(screen.getByLabelText('Representative Full Name')).toHaveValue('Sara Test')
    expect(screen.getByLabelText('Title / Academic Position')).toHaveValue('Coordinator')
    expect(screen.getByLabelText('Direct Contact Phone')).toHaveValue('+212612345678')
    expect(screen.getByLabelText('Supporting link (optional)')).toHaveValue('https://example.test/club')
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(reads()).toHaveLength(1)
    expect(reads()[0][1]).toEqual(expect.objectContaining({ credentials: 'include', cache: 'no-store' }))
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    expect(patches()).toHaveLength(0)
  })

  it('opens an empty form only after confirmed absence and saves a partial draft only on Save', async () => {
    draft = null
    const name = await loaded()
    expect(name).toHaveValue('')
    expect(name).not.toBeRequired()
    await userEvent.type(name, '  New Club  ')
    expect(patches()).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(name).toHaveValue('New Club'))
    expect(patches()).toHaveLength(1)
    expect(JSON.parse(String(patches()[0][1]?.body))).toEqual({ organizationName: 'New Club' })
    expect(patches()[0][1]).toEqual(expect.objectContaining({ credentials: 'include', cache: 'no-store' }))
  })

  it('sends only changed fields and explicitly clears an existing value with null', async () => {
    await loaded()
    await userEvent.clear(screen.getByLabelText('Title / Academic Position'))
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(screen.getByLabelText('Title / Academic Position')).toBeEnabled())
    expect(JSON.parse(String(patches()[0][1]?.body))).toEqual({ academicPosition: null })
    expect(draft?.organizationName).toBe('Campus Club')
    expect(draft?.academicPosition).toBeNull()
    expect(request.mock.calls.some(([url]) => url === '/api/organizer-applications/submit')).toBe(false)
  })

  it('preserves unsaved inputs after a failed save and locks duplicate submissions', async () => {
    let release!: () => void
    saveGate = new Promise<void>((resolve) => { release = resolve })
    saveStatus = 503
    const name = await loaded()
    await userEvent.clear(name)
    await userEvent.type(name, 'Updated Club')
    const button = screen.getByRole('button', { name: 'Save draft' })
    await act(async () => {
      fireEvent.submit(button.closest('form')!)
      fireEvent.submit(button.closest('form')!)
    })
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(button).toBeDisabled()
    expect(name).toBeDisabled()
    release()
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveFocus()
    expect(name).toHaveValue('Updated Club')
    saveGate = null
    saveStatus = 200
    await userEvent.click(button)
    await waitFor(() => expect(name).toBeEnabled())
    expect(patches()).toHaveLength(2)
    expect(draft?.organizationName).toBe('Updated Club')
  })

  it.each([400, 403])('keeps edits after a rejected save (%s) without claiming success', async (status) => {
    const name = await loaded()
    saveStatus = status
    fireEvent.change(name, { target: { value: 'Unsaved Club' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(name).toHaveValue('Unsaved Club')
    expect(draft?.organizationName).toBe('Campus Club')
    expect(screen.queryByText('Draft saved.')).not.toBeInTheDocument()
  })

  it('does not confirm saving when a successful response is malformed or has no saved draft', async () => {
    const name = await loaded()
    fireEvent.change(name, { target: { value: 'Unsaved Club' } })
    request.mockResolvedValueOnce(Response.json({ draft: null, canEdit: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(name).toHaveValue('Unsaved Club')
    expect(screen.queryByText('Draft saved.')).not.toBeInTheDocument()
  })

  it('discards unsaved edits on reopen and restores only the saved baseline', async () => {
    const view = mount()
    const name = await screen.findByLabelText(nameLabel)
    fireEvent.change(name, { target: { value: 'Never saved' } })
    view.unmount()
    expect(await loaded()).toHaveValue('Campus Club')
    expect(patches()).toHaveLength(0)
  })

  it('aborts an in-flight save on unmount and ignores the late response', async () => {
    let release!: () => void
    saveGate = new Promise<void>((resolve) => { release = resolve })
    const view = mount()
    fireEvent.change(await screen.findByLabelText(nameLabel), { target: { value: 'Updated Club' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(patches()).toHaveLength(1))
    const signal = patches()[0][1]?.signal
    view.unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => { release(); await saveGate })
    expect(screen.queryByText('Draft saved.')).not.toBeInTheDocument()
  })

  it.each([404, 503, 'offline'] as const)('withholds editable fields after failed retrieval (%s) and restores them on Retry', async (failure) => {
    readStatus = failure === 'offline' ? 200 : failure
    readError = failure === 'offline'
    mount()
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.queryByLabelText(nameLabel)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
    readStatus = 200
    readError = false
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }))
    expect(await screen.findByLabelText(nameLabel)).toHaveValue('Campus Club')
    expect(patches()).toHaveLength(0)
  })

  it('rejects malformed server data instead of presenting an empty draft', async () => {
    readBody = { draft: { ...saved, type: 'UNKNOWN' }, canEdit: true }
    mount()
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.queryByLabelText(nameLabel)).not.toBeInTheDocument()
    expect(patches()).toHaveLength(0)
  })

  it('handles a denied read without creating a writable empty draft', async () => {
    readStatus = 403
    mount()
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.queryByLabelText(nameLabel)).not.toBeInTheDocument()
    expect(patches()).toHaveLength(0)
  })

  it('uses backend edit permission to show saved fields read-only', async () => {
    canEdit = false
    expect(await loaded()).toBeDisabled()
    expect(screen.getByLabelText('Entity Category')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
    expect(patches()).toHaveLength(0)
  })

  it('allows a needs-changes organizer to restore the draft without resubmitting it', async () => {
    organizationStatus = 'NEEDS_CHANGES'
    expect(await loaded()).toHaveValue('Campus Club')
    expect(reads()).toHaveLength(1)
    expect(patches()).toHaveLength(0)
  })

  it.each([
    ['STUDENT', 'PENDING', 'Student dashboard'],
    ['ORGANIZER', 'REJECTED', 'Your application was not approved'],
    ['ORGANIZER', 'APPROVED', 'Organizer dashboard'],
  ])('blocks %s/%s before requesting draft data', async (accountRole, status, destination) => {
    role = accountRole
    organizationStatus = status
    mount()
    expect(await screen.findByRole('heading', { name: destination })).toBeVisible()
    expect(reads()).toHaveLength(0)
    expect(patches()).toHaveLength(0)
  })

  it('returns an expired session to login', async () => {
    readStatus = 401
    mount()
    expect(await screen.findByRole('heading', { name: 'Welcome back to Younity' })).toBeVisible()
    expect(screen.queryByLabelText(nameLabel)).not.toBeInTheDocument()
  })

  it('aborts pending retrieval on unmount and never autosaves unsaved edits', async () => {
    let release!: () => void
    readGate = new Promise<void>((resolve) => { release = resolve })
    const view = mount()
    await waitFor(() => expect(reads()).toHaveLength(1))
    const signal = reads()[0][1]?.signal
    expect(signal?.aborted).toBe(false)
    view.unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => { release(); await readGate })
    expect(patches()).toHaveLength(0)
  })
})