import { render, screen } from '@testing-library/react'
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
import App from './App'
import { apiRequest } from './api/client'

vi.mock('./api/client', () => ({
  apiRequest: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(apiRequest)
    .mockReset()
    .mockImplementation(async () => {
      return new Response(null, { status: 401 })
    })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('merged registration and login routes', () => {
  it.each(['/', '/register', '/register/'])(
    'opens login from %s',
    async (path) => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      )

      expect(
        await screen.findByRole('form', {
          name: 'Sign in to Younity',
        }),
      ).toBeInTheDocument()

      expect(
        screen.getByRole('heading', {
          name: 'Welcome back to Younity',
        }),
      ).toBeInTheDocument()

      expect(
        screen.queryByRole('heading', {
          name: 'Create your account',
        }),
      ).not.toBeInTheDocument()

      expect(
        screen.getByRole('link', {
          name: /Join as Student/,
        }),
      ).toHaveAttribute('href', '/register/student')

      expect(
        screen.getByRole('link', {
          name: /^Organizer/,
        }),
      ).toHaveAttribute('href', '/register/organizer')
    },
  )

  it.each(['/register/student', '/register/organizer'])(
    'opens login from %s',
    async (path) => {
      const user = userEvent.setup()

      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      )

      await user.click(
        screen.getByRole('link', {
          name: 'Sign In',
        }),
      )

      expect(
        screen.getByRole('heading', {
          name: 'Welcome back to Younity',
        }),
      ).toBeInTheDocument()

      expect(
        await screen.findByRole('form', {
          name: 'Sign in to Younity',
        }),
      ).toBeInTheDocument()
    },
  )

  it.each([true, false])(
    'shows verified pending status with DEV=%s',
    async (development) => {
      vi.stubEnv('DEV', development)

      vi.mocked(apiRequest).mockImplementation(async () => {
        return Response.json({
          id: 'pending-user-fixture',
          email: 'organizer@example.test',
          role: 'ORGANIZER',
          status: 'PENDING',
          organization: {
            verificationStatus: 'PENDING',
          },
        })
      })

      render(
        <MemoryRouter initialEntries={['/organizer/pending']}>
          <App />
        </MemoryRouter>,
      )

      expect(
        await screen.findByRole('heading', {
          name: 'Organization verification pending',
        }),
      ).toBeInTheDocument()

      expect(
        screen.getByRole('button', {
          name: 'Check status again',
        }),
      ).toBeInTheDocument()

      expect(
        screen.queryByText(/YNT-ORG-2025/),
      ).not.toBeInTheDocument()

      expect(
        screen.queryByRole('heading', {
          name: 'Academic Liaison Desk',
        }),
      ).not.toBeInTheDocument()

      expect(
        screen.queryByRole('heading', {
          name: 'Application status unavailable',
        }),
      ).not.toBeInTheDocument()
    },
  )

  it('redirects to the organizer dashboard after approval is confirmed', async () => {
    const account = {
      id: 'organizer-fixture',
      email: 'organizer@example.test',
      role: 'ORGANIZER',
    }

    vi.mocked(apiRequest)
      .mockResolvedValueOnce(
        Response.json({
          ...account,
          status: 'PENDING',
          organization: {
            verificationStatus: 'PENDING',
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ...account,
          status: 'ACTIVE',
          organization: {
            verificationStatus: 'APPROVED',
          },
        }),
      )

    render(
      <MemoryRouter initialEntries={['/organizer/pending']}>
        <App />
      </MemoryRouter>,
    )

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Check status again',
      }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Organizer dashboard',
      }),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('heading', {
        name: 'Organization verification pending',
      }),
    ).not.toBeInTheDocument()
  })

  it('redirects an active student away from organizer pending', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(
      Response.json({
        id: 'student-fixture',
        email: 'student@example.test',
        role: 'STUDENT',
        status: 'ACTIVE',
        organization: null,
      }),
    )

    render(
      <MemoryRouter initialEntries={['/organizer/pending']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Student dashboard',
      }),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('heading', {
        name: 'Organization verification pending',
      }),
    ).not.toBeInTheDocument()
  })

  it('hides pending content when refresh fails and permits retry', async () => {
    const pending = {
      id: 'organizer-fixture',
      email: 'organizer@example.test',
      role: 'ORGANIZER',
      status: 'PENDING',
      organization: {
        verificationStatus: 'PENDING',
      },
    }

    vi.mocked(apiRequest)
      .mockResolvedValueOnce(Response.json(pending))
      .mockResolvedValueOnce(
        new Response(null, { status: 503 }),
      )
      .mockResolvedValueOnce(Response.json(pending))

    render(
      <MemoryRouter initialEntries={['/organizer/pending']}>
        <App />
      </MemoryRouter>,
    )

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Check status again',
      }),
    )

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(
      'We could not check your session',
    )

    expect(
      screen.queryByRole('heading', {
        name: 'Organization verification pending',
      }),
    ).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Retry session check',
      }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Organization verification pending',
      }),
    ).toBeInTheDocument()
  })
})