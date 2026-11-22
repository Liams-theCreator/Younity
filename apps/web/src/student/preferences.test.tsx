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
  university: null as string | null,
  academicField: null,
  studyLevel: null,
  opportunityFormat: null,
}

let profile: typeof saved
let accountName: { firstName: string; lastName: string }
let nameReadStatus: number
let nameSaveStatus: number
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
  accountName = { firstName: 'Sara', lastName: 'Test' }
  nameReadStatus = 200
  nameSaveStatus = 200
  readStatus = 200
  saveStatus = 200
  sessionStatus = 200
  readError = false
  saveGate = null
  role = 'STUDENT'

  request.mockReset().mockImplementation(
    async (input, options) => {
      if (input === '/api/auth/me') {
        const complete = new Set(profile.interests).size >= 2
        return sessionStatus === 200
          ? Response.json({
              ...student,
              role,
              organization:
                role === 'ORGANIZER'
                  ? { verificationStatus: 'PENDING' }
                  : null,
              ...(role === 'STUDENT' && {
                onboarding: { complete, nextStep: complete ? 'NONE' : 'SELECT_INTERESTS' },
              }),
            })
          : new Response(null, { status: sessionStatus })
      }

      if (input === '/api/categories') return Response.json({ categories: [] })
      if (String(input).startsWith('/api/events?')) {
        return Response.json({ items: [], categories: [], page: 1, pageSize: 12, total: 0 })
      }

      if (input === '/api/student/profile') {
        if (options?.method === 'PATCH') {
          if (nameSaveStatus !== 200) return new Response(null, { status: nameSaveStatus })
          accountName = { ...accountName, ...JSON.parse(String(options.body)) }
        } else if (nameReadStatus !== 200) {
          return new Response(null, { status: nameReadStatus })
        }
        return Response.json(accountName)
      }

      if (input === '/api/student/preferences') {
        if (options?.method === 'PATCH') {
          if (saveGate) await saveGate

          if (saveStatus !== 200) {
            return new Response(null, {
              status: saveStatus,
            })
          }

          profile = { ...profile, ...JSON.parse(String(options.body)) }
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
    profile.university = 'Campus University'
    await mount()

    const ai = await screen.findByRole('checkbox', {
      name: /AI & Data Science/,
    })

    expect(ai).toBeChecked()
    expect(screen.getByText('1 selected')).toBeVisible()
    expect(screen.queryByLabelText(/University/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back to profile' })).not.toBeInTheDocument()

    expect(
      screen.queryByRole('button', {
        name: /Skip for now/,
      }),
    ).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Save preferences & enter Younity',
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

    expect(screen.getByText('2 selected')).toBeVisible()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Save preferences & enter Younity',
      }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Campus events',
      }),
    ).toBeVisible()

    expect(patches()).toHaveLength(1)

    expect(
      JSON.parse(String(patches()[0][1]?.body)),
    ).toEqual({
      academicField: null,
      studyLevel: null,
      opportunityFormat: null,
      interests: ['AI_DATA', 'ROBOTICS_IOT'],
    })
    expect(profile.university).toBe('Campus University')

    expect(
      patches()[0][1]?.credentials,
    ).toBe('include')

    expect(
      request.mock.calls.filter(
        ([url]) => url === '/api/auth/me',
      ),
    ).toHaveLength(2)

    expect(screen.queryByRole('link', { name: /your account/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit discovery preferences' })).not.toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }))
    await userEvent.click(screen.getByRole('link', { name: 'Edit profile' }))
    expect(await screen.findByRole('heading', { name: 'Student profile' })).toBeVisible()

    expect(
      await screen.findByRole('checkbox', {
        name: /Robotics & Smart IoT/,
      }),
    ).toBeChecked()

    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()
    const university = screen.getByRole('combobox', { name: 'University / Academic Institution (optional)' })
    const selectedUniversity = 'Mohammed V University (Rabat - ENSIAS, FSR, EMI)'
    expect(university).toHaveValue('Campus University')
    await userEvent.selectOptions(university, selectedUniversity)
    await userEvent.selectOptions(screen.getByLabelText('Academic level'), 'Second Year (L2)')

    saveStatus = 503
    await userEvent.click(save)
    expect(await screen.findByRole('alert')).toHaveTextContent('Preferences could not be loaded or saved')
    expect(university).toHaveValue(selectedUniversity)
    expect(screen.getByRole('heading', { name: 'Student profile' })).toBeVisible()

    saveStatus = 200
    await userEvent.click(save)
    expect(await screen.findByText('Preferences saved.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Student profile' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Your discovery preferences' })).not.toBeInTheDocument()
    expect(save).toBeDisabled()
    expect(profile).toMatchObject({ university: selectedUniversity, studyLevel: 'SECOND_YEAR' })

    await userEvent.click(screen.getByRole('link', { name: 'Back to events' }))
    expect(await screen.findByRole('heading', { name: 'Campus events' })).toBeVisible()
  })

  it('opens the inline editor from a completed student’s old preferences link', async () => {
    profile.interests = ['AI_DATA', 'ROBOTICS_IOT']
    render(<MemoryRouter initialEntries={['/student/preferences']}><App /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Student profile' })).toBeVisible()
    expect(await screen.findByRole('checkbox', { name: 'AI & Data Science' })).toBeChecked()
    expect(screen.queryByRole('heading', { name: 'Your discovery preferences' })).not.toBeInTheDocument()
  })

  it('edits the account name independently and retains unsaved names after a failed save', async () => {
    profile.interests = ['AI_DATA', 'ROBOTICS_IOT']
    nameReadStatus = 503
    const view = render(<MemoryRouter initialEntries={['/student/profile']}><App /></MemoryRouter>)

    const retry = await screen.findByRole('button', { name: 'Retry loading name' })
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument()
    nameReadStatus = 200
    await userEvent.click(retry)

    const firstName = await screen.findByRole('textbox', { name: 'First name' })
    const lastName = screen.getByRole('textbox', { name: 'Last name' })
    const save = screen.getByRole('button', { name: 'Save name' })
    expect(firstName).toHaveValue('Sara')
    expect(lastName).toHaveValue('Test')
    expect(save).toBeDisabled()

    await userEvent.clear(firstName)
    await userEvent.type(firstName, ' Lina ')
    nameSaveStatus = 503
    await userEvent.click(save)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your name')
    expect(firstName).toHaveValue(' Lina ')

    nameSaveStatus = 200
    await userEvent.click(save)
    expect(await screen.findByText('Name saved.')).toBeVisible()
    expect(firstName).toHaveValue('Lina')
    expect(patches().map(([path, options]) => [path, JSON.parse(String(options?.body))])).toEqual([
      ['/api/student/profile', { firstName: 'Lina' }],
      ['/api/student/profile', { firstName: 'Lina' }],
    ])

    await userEvent.clear(lastName)
    await userEvent.type(lastName, 'El Idrissi')
    await userEvent.click(save)
    expect(await screen.findByText('Name saved.')).toBeVisible()
    view.unmount()

    render(<MemoryRouter initialEntries={['/student/profile']}><App /></MemoryRouter>)
    expect(await screen.findByRole('textbox', { name: 'First name' })).toHaveValue('Lina')
    expect(screen.getByRole('textbox', { name: 'Last name' })).toHaveValue('El Idrissi')
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
      expect(screen.queryByRole('link', { name: 'Back to profile' })).not.toBeInTheDocument()

      expect(
        screen.queryByRole('button', {
          name: 'Save preferences & enter Younity',
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
      name: 'Save preferences & enter Younity',
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
        name: 'Campus events',
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
        name: 'Save preferences & enter Younity',
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
