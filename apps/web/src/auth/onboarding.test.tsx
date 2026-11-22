import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import App from '../App'
import { apiRequest } from '../api/client'
import { parseSessionUser } from './parseSessionUser'

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }))

const request = vi.mocked(apiRequest)

let role: 'STUDENT' | 'ORGANIZER'
let complete: boolean
let status: string
let acknowledged: boolean
let ackStatus: number
let gate: Promise<void> | null

function profile() {
  return {
    id: 'onboarding',
    email: 'onboarding@example.test',
    role,
    status: 'ACTIVE',
    organization:
      role === 'STUDENT'
        ? null
        : {
            verificationStatus: status,
            approvalAcknowledged: acknowledged,
            application: complete
              ? {
                  id: 'application',
                  status,
                  reviewerNote: 'Please update your contact details.',
                }
              : null,
          },
    onboarding: {
      complete,
      nextStep: complete
        ? 'NONE'
        : role === 'STUDENT'
          ? 'SELECT_INTERESTS'
          : 'COMPLETE_ORGANIZER_APPLICATION',
    },
  }
}

beforeEach(() => {
  role = 'ORGANIZER'
  complete = true
  status = 'APPROVED'
  acknowledged = false
  ackStatus = 204
  gate = null

  request.mockReset().mockImplementation(async (url) => {
    if (url === '/api/auth/me') {
      return Response.json(profile())
    }

    if (url === '/api/auth/acknowledge-approval') {
      if (gate) await gate
      if (ackStatus === 204) acknowledged = true
      return new Response(null, { status: ackStatus })
    }

    if (url === '/api/student/preferences') {
      return Response.json({
        interests: [],
        university: null,
        academicField: null,
        studyLevel: null,
        opportunityFormat: null,
      })
    }

    if (url === '/api/organizer-applications/draft') {
      return Response.json({ draft: null, canEdit: true })
    }

    throw new Error(`Unexpected request: ${String(url)}`)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mount(path = '/organizer/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

const acks = () =>
  request.mock.calls.filter(
    ([url]) => url === '/api/auth/acknowledge-approval',
  )

describe('onboarding routing and approval acknowledgment', () => {
  it.each(['/student/dashboard', '/student/profile'])('resumes an incomplete student on preferences from %s', async (path) => {
    role = 'STUDENT'
    complete = false

    mount(path)

    expect(
      await screen.findByRole('heading', {
        name: 'Your discovery preferences',
      }),
    ).toBeVisible()
  })

  it('resumes an unsubmitted organizer on the saved draft instead of pending review', async () => {
    complete = false
    status = 'PENDING'

    mount('/organizer/pending')

    expect(
      await screen.findByRole('heading', {
        name: 'Organizer application draft',
      }),
    ).toBeVisible()

    expect(
      screen.getByRole('link', { name: 'Explore events' }),
    ).toHaveAttribute('href', '/events')
  })

  it('routes completed corrections by review status and displays real feedback', async () => {
    status = 'NEEDS_CHANGES'
    mount('/organizer/dashboard')

    expect(
      await screen.findByRole('heading', {
        name: 'Institutional Dossier: Changes Requested',
      }),
    ).toBeVisible()

    expect(
      screen.getByText('Please update your contact details.'),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Update application' })).toHaveAttribute('href', '/organizer/application')
  })

  it.each([
    'Enter organizer dashboard',
    'Explore Campus Events as Attendee',
  ])(
    'persists acknowledgment before %s and skips approval on a new visit',
    async (button) => {
      const view = mount()

      await screen.findByRole('heading', {
        name: 'Institutional Dossier: Application Approved',
      })

      await userEvent.click(
        screen.getByRole('button', { name: button }),
      )

      expect(
        await screen.findByRole('heading', {
          name:
            button === 'Enter organizer dashboard'
              ? 'Organizer dashboard'
              : 'Campus events',
        }),
      ).toBeVisible()

      expect(acks()).toHaveLength(1)

      expect(acks()[0][1]).toMatchObject({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })

      view.unmount()
      mount()

      expect(
        await screen.findByRole('heading', {
          name: 'Organizer dashboard',
        }),
      ).toBeVisible()

      expect(acks()).toHaveLength(1)
    },
  )

  it('preserves the approval page on failure and permits retry', async () => {
    ackStatus = 503
    mount()

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Enter organizer dashboard',
      }),
    )

    expect(await screen.findByRole('alert')).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Refresh status' })).toBeVisible()
    expect(acknowledged).toBe(false)

    ackStatus = 204

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Enter organizer dashboard',
      }),
    )

    await screen.findByRole('heading', {
      name: 'Organizer dashboard',
    })

    expect(acks()).toHaveLength(2)
  })

  it('locks duplicate exit actions while confirmation is pending', async () => {
    let release!: () => void

    gate = new Promise<void>((resolve) => {
      release = resolve
    })

    mount()

    const button = await screen.findByRole('button', {
      name: 'Enter organizer dashboard',
    })

    await act(async () => {
      fireEvent.click(button)
      fireEvent.click(button)
    })

    await waitFor(() => expect(acks()).toHaveLength(1))

    expect(button).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'Explore Campus Events as Attendee',
      }),
    ).toBeDisabled()

    release()

    await screen.findByRole('heading', {
      name: 'Organizer dashboard',
    })
  })

  it('refreshes pending status on visibility in the shared provider without a local session copy', async () => {
    status = 'PENDING'
    mount('/organizer/pending')

    await screen.findByRole('heading', {
      name: 'Institutional Dossier Submitted',
    })
    expect(screen.getByText('ID: application')).toBeVisible()
    expect(screen.getByText('Status: Queued')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to Registration Step 2' })).toHaveAttribute('href', '/organizer/application')

    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    status = 'APPROVED'

    await act(async () => {
      fireEvent(document, new Event('visibilitychange'))
    })

    expect(
      await screen.findByRole('heading', {
        name: 'Institutional Dossier: Application Approved',
      }),
    ).toBeVisible()
  })

  it.each([
    { complete: false, nextStep: 'NONE' },
    { complete: true, nextStep: 'COMPLETE_ORGANIZER_APPLICATION' },
    { complete: 'yes', nextStep: 'NONE' },
  ])('rejects malformed completion contracts', (onboarding) => {
    expect(() =>
      parseSessionUser({ ...profile(), onboarding }),
    ).toThrow()
  })
})
