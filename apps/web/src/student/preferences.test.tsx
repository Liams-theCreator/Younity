import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import App from '../App'
import { apiRequest } from '../api/client'
import {
  parsePreferences,
  preferencesPayload,
} from './preferences'
import { emptyPreferences } from '../registration/studentPreferences'
import { mapStudentPayload } from '../registration/payload'
import { validateStudentDraft } from '../registration/model'

vi.mock('../api/client', () => ({
  apiRequest: vi.fn(),
}))

const request = vi.mocked(apiRequest)

const student = {
  id: 'student',
  email: 'student@example.test',
  role: 'STUDENT',
  status: 'ACTIVE',
  organization: null,
}

const saved = {
  interests: ['AI_DATA'],
  university: null,
  academicField: null,
  studyLevel: null,
  opportunityFormat: null,
}

let profile: typeof saved
let readStatus: number
let saveStatus: number
let sessionStatus: number
let readError: boolean
let saveGate: Promise<void> | null
let role: string

const patches = () =>
  request.mock.calls.filter(
    ([, options]) => options?.method === 'PATCH',
  )

beforeEach(() => {
  profile = structuredClone(saved)
  readStatus = 200
  saveStatus = 200
  sessionStatus = 200
  readError = false
  saveGate = null
  role = 'STUDENT'

  request.mockReset().mockImplementation(
    async (input, options) => {
      if (input === '/api/auth/me') {
        return sessionStatus === 200
          ? Response.json({
              ...student,
              role,
              organization:
                role === 'ORGANIZER'
                  ? { verificationStatus: 'PENDING' }
                  : null,
            })
          : new Response(null, { status: sessionStatus })
      }

      if (input === '/api/student/preferences') {
        if (options?.method === 'PATCH') {
          if (saveGate) await saveGate

          if (saveStatus !== 200) {
            return new Response(null, {
              status: saveStatus,
            })
          }

          profile = JSON.parse(String(options.body))
          return Response.json(profile)
        }

        if (readError) throw new TypeError('Offline')

        return readStatus === 200
          ? Response.json(profile)
          : new Response(null, { status: readStatus })
      }

      throw new Error(
        `Unexpected request ${String(input)}`,
      )
    },
  )
})

async function mount() {
  render(
    <MemoryRouter initialEntries={['/student/preferences']}>
      <App />
    </MemoryRouter>,
  )

  await screen.findByRole('heading', {
    name: 'Your discovery preferences',
  })
}

describe('Saved student preferences', () => {
  it('restores values, enforces two interests, saves real enum payload and refreshes the session', async () => {
    await mount()

    const ai = await screen.findByRole('checkbox', {
      name: /AI & Data Science/,
    })

    expect(ai).toBeChecked()

    expect(
      screen.queryByRole('button', {
        name: /Skip for now/,
      }),
    ).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Save and continue',
      }),
    )

    expect(
      screen.getByText(
        'Select at least two different interests.',
        { selector: '.field-error' },
      ),
    ).toBeVisible()

    expect(patches()).toHaveLength(0)

    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /Robotics & Smart IoT/,
      }),
    )

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Save and continue',
      }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Student dashboard',
      }),
    ).toBeVisible()

    expect(patches()).toHaveLength(1)

    expect(
      JSON.parse(String(patches()[0][1]?.body)),
    ).toEqual({
      ...saved,
      interests: ['AI_DATA', 'ROBOTICS_IOT'],
    })

    expect(
      patches()[0][1]?.credentials,
    ).toBe('include')

    expect(
      request.mock.calls.filter(
        ([url]) => url === '/api/auth/me',
      ),
    ).toHaveLength(2)

    await userEvent.click(
      screen.getByRole('link', {
        name: 'Edit discovery preferences',
      }),
    )

    expect(
      await screen.findByRole('checkbox', {
        name: /Robotics & Smart IoT/,
      }),
    ).toBeChecked()
  })

  it.each([false, true])(
    'does not present an empty form after a failed read (offline=%s), and retries',
    async (offline) => {
      readStatus = 503
      readError = offline

      await mount()

      expect(
        await screen.findByRole('alert'),
      ).toBeVisible()

      expect(
        screen.queryByRole('button', {
          name: 'Save and continue',
        }),
      ).not.toBeInTheDocument()

      readStatus = 200
      readError = false

      await userEvent.click(
        screen.getByRole('button', {
          name: 'Retry loading preferences',
        }),
      )

      expect(
        await screen.findByRole('checkbox', {
          name: /AI & Data Science/,
        }),
      ).toBeChecked()
    },
  )

  it('preserves selections after failed saving and prevents duplicate submissions', async () => {
    let release!: () => void

    saveGate = new Promise<void>((resolve) => {
      release = resolve
    })
    saveStatus = 503

    await mount()

    await userEvent.click(
      await screen.findByRole('checkbox', {
        name: /Robotics & Smart IoT/,
      }),
    )

    const button = screen.getByRole('button', {
      name: 'Save and continue',
    })

    fireEvent.submit(button.closest('form')!)
    fireEvent.submit(button.closest('form')!)

    await waitFor(() =>
      expect(patches()).toHaveLength(1),
    )

    expect(button).toBeDisabled()

    release()

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(
      'Preferences could not be loaded or saved',
    )

    expect(
      screen.getByRole('checkbox', {
        name: /Robotics & Smart IoT/,
      }),
    ).toBeChecked()

    saveGate = null
    saveStatus = 200

    await userEvent.click(button)

    expect(
      await screen.findByRole('heading', {
        name: 'Student dashboard',
      }),
    ).toBeVisible()
  })

  it('explains the verified-email requirement without displaying editable saved data', async () => {
    readStatus = 403

    await mount()

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('verified email')

    expect(
      screen.queryByRole('button', {
        name: 'Save and continue',
      }),
    ).not.toBeInTheDocument()
  })

  it('returns to login when the preferences request reports an expired session', async () => {
    readStatus = 401

    render(
      <MemoryRouter initialEntries={['/student/preferences']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Welcome back to Younity',
      }),
    ).toBeVisible()
  })

  it('redirects organizers without requesting student preferences', async () => {
    role = 'ORGANIZER'

    render(
      <MemoryRouter initialEntries={['/student/preferences']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Organization verification pending',
      }),
    ).toBeVisible()

    expect(
      request.mock.calls.some(
        ([url]) => url === '/api/student/preferences',
      ),
    ).toBe(false)
  })

  it('allows signup without university and omits blank university from the API payload', () => {
    const draft = {
      firstName: 'Sara',
      lastName: 'Test',
      email: 'sara@example.test',
      password: 'Example-password-2026!',
      confirmPassword: 'Example-password-2026!',
      acceptedPolicies: true,
      university: '',
    }

    expect(validateStudentDraft(draft)).toEqual({})

    expect(
      mapStudentPayload(draft, emptyPreferences),
    ).not.toHaveProperty('university')
  })

  it('validates server enum values and rejects malformed data instead of claiming an empty draft', () => {
    expect(() =>
      parsePreferences({ unexpected: true }),
    ).toThrow()

    expect(() =>
      parsePreferences({
        ...saved,
        interests: ['UNKNOWN'],
      }),
    ).toThrow()

    expect(() =>
      parsePreferences({
        ...saved,
        interests: ['AI_DATA', 'AI_DATA'],
      }),
    ).toThrow()

    expect(() =>
      preferencesPayload({
        university: '',
        preferences: emptyPreferences,
      }),
    ).toThrow('two different')
  })
})