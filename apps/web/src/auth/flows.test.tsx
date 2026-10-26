import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MemoryRouter,
  useLocation,
} from 'react-router'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import App from '../App'
import AuthProvider from './AuthProvider'
import AuthRoutes from './AuthRoutes'
import LogoutButton from '../components/LogoutButton'
import { useAuth } from './useAuth'
import { apiRequest } from '../api/client'

vi.mock('../api/client', () => ({
  demoEnabled: false,
  apiRequest: vi.fn(),
}))

const request = vi.mocked(apiRequest)

const student = {
  id: 'student-fixture',
  email: 'student@example.test',
  role: 'STUDENT',
  status: 'ACTIVE',
  organization: null,
}

const organizer = {
  ...student,
  role: 'ORGANIZER',
  organization: {
    verificationStatus: 'APPROVED',
  },
}

let session:
  | typeof student
  | typeof organizer
  | null

function Location() {
  const { pathname } = useLocation()

  return (
    <output aria-label="Current route">
      {pathname}
    </output>
  )
}

function ExpiryProbe() {
  const auth = useAuth()

  return (
    <button
      onClick={() => {
        void auth
          .requestProtected('/api/private')
          .catch(() => undefined)
      }}
    >
      Protected request
    </button>
  )
}

function mount(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Location />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  session = null

  request.mockReset().mockImplementation(
    async (input, options) => {
      if (input === '/api/auth/me') {
        return session
          ? Response.json(session)
          : new Response(null, {
              status: 401,
            })
      }

      if (input === '/api/auth/login') {
        const data = JSON.parse(
          options?.body as string,
        )

        if (data.password !== 'test-password') {
          return new Response(null, {
            status: 401,
          })
        }

        session = student

        return new Response(null, {
          status: 204,
        })
      }

      if (input === '/api/auth/logout') {
        session = null

        return new Response(null, {
          status: 204,
        })
      }

      return new Response(null, {
        status: 401,
      })
    },
  )
})

describe('AUTH-05 frontend journeys', () => {
  it('connects login to both registration pages and back', async () => {
    mount()

    await screen.findByRole('form')

    await userEvent.click(
      screen.getByRole('link', {
        name: /Join as Student/,
      }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Create Student Account',
      }),
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('link', {
        name: /^Sign in$/i,
      }),
    )

    await screen.findByRole('form')

    await userEvent.click(
      screen.getByRole('link', {
        name: /^Organizer/,
      }),
    )

    expect(
      await screen.findByRole('heading', {
        name:
          'Institutional Organizer Registration',
      }),
    ).toBeInTheDocument()

    expect(
      screen.getAllByRole('link', {
        name: /^Sign in$/i,
      }).length,
    ).toBeGreaterThan(0)
  })

  it('supports invalid credentials, correction, Enter and logout', async () => {
    mount()

    const interaction = userEvent.setup()

    await interaction.type(
      await screen.findByLabelText(
        'Email Address',
      ),
      student.email,
    )

    await interaction.type(
      screen.getByLabelText('Password'),
      'wrong{Enter}',
    )

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(
      'Email or password is incorrect',
    )

    await interaction.clear(
      screen.getByLabelText('Password'),
    )

    await interaction.type(
      screen.getByLabelText('Password'),
      'test-password{Enter}',
    )

    expect(
      await screen.findByRole('heading', {
        name: 'Student dashboard',
      }),
    ).toBeInTheDocument()

    expect(
      screen.getByLabelText('Current route'),
    ).toHaveTextContent('/student/dashboard')

    await interaction.click(
      screen.getByRole('button', {
        name: 'Sign out',
      }),
    )

    expect(
      await screen.findByRole('form'),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('heading', {
        name: 'Student dashboard',
      }),
    ).not.toBeInTheDocument()
  })

  it('toggles password visibility without submitting', async () => {
    mount()

    await screen.findByLabelText('Password')

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Show password',
      }),
    )

    expect(
      screen.getByLabelText('Password'),
    ).toHaveAttribute('type', 'text')

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Hide password',
      }),
    )

    expect(
      screen.getByLabelText('Password'),
    ).toHaveAttribute('type', 'password')

    expect(
      request.mock.calls.some(
        ([url]) => url === '/api/auth/login',
      ),
    ).toBe(false)
  })

  it('hides protected content during restoration', async () => {
    let resolve!: (
      response: Response,
    ) => void

    request.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )

    mount('/student/dashboard')

    expect(
      screen.getByText(
        'Checking your session…',
      ),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('heading', {
        name: 'Student dashboard',
      }),
    ).not.toBeInTheDocument()

    await act(async () => {
      resolve(Response.json(student))
    })

    expect(
      await screen.findByRole('heading', {
        name: 'Student dashboard',
      }),
    ).toBeInTheDocument()
  })

  it('redirects an anonymous direct visit to login', async () => {
    mount('/organizer/dashboard')

    await screen.findByRole('form')

    expect(
      screen.getByLabelText('Current route'),
    ).toHaveTextContent('/login')
  })

  it.each([
    [
      'APPROVED',
      'ACTIVE',
      'Organizer dashboard',
      '/organizer/dashboard',
    ],
    [
      'PENDING',
      'PENDING',
      'Institutional Dossier Submitted',
      '/organizer/pending',
    ],
    [
      'NEEDS_CHANGES',
      'ACTIVE',
      'Your application needs changes',
      '/organizer/status',
    ],
    [
      'REJECTED',
      'ACTIVE',
      'Your application was not approved',
      '/organizer/status',
    ],
  ])(
    'restores organizer status %s',
    async (
      verificationStatus,
      status,
      title,
      path,
    ) => {
      session = {
        ...organizer,
        status,
        organization: {
          verificationStatus,
        },
      }

      mount('/student/dashboard')

      expect(
        await screen.findByRole('heading', {
          name: title,
        }),
      ).toBeInTheDocument()

      expect(
        screen.getByLabelText(
          'Current route',
        ),
      ).toHaveTextContent(path)

      expect(
        screen.queryByRole('heading', {
          name: 'Student dashboard',
        }),
      ).not.toBeInTheDocument()
    },
  )

  it('blocks suspended profiles returned with HTTP 200', async () => {
    session = {
      ...student,
      status: 'SUSPENDED',
    }

    mount('/student/dashboard')

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(
      'does not have access',
    )

    expect(
      screen.queryByRole('heading', {
        name: 'Student dashboard',
      }),
    ).not.toBeInTheDocument()
  })

  it('permits retry after startup failure', async () => {
    request.mockResolvedValueOnce(
      new Response(null, {
        status: 404,
      }),
    )

    mount()

    expect(
      await screen.findByText(
        'We could not check your session. Please try again.',
      ),
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Retry session check',
      }),
    )

    await waitFor(() => {
      expect(
        screen.queryByText(
          'We could not check your session. Please try again.',
        ),
      ).not.toBeInTheDocument()
    })
  })

  it('rejects logout while the session still exists', async () => {
    session = student

    const original =
      request.getMockImplementation()!

    request.mockImplementation(
      (input, options) =>
        input === '/api/auth/logout'
          ? Promise.resolve(
              new Response(null, {
                status: 204,
              }),
            )
          : original(input, options),
    )

    mount('/student/dashboard')

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Sign out',
      }),
    )

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(
      'session is still active',
    )

    expect(
      screen.queryByRole('heading', {
        name: 'Student dashboard',
      }),
    ).not.toBeInTheDocument()

    expect(
      screen.getByRole('button', {
        name: 'Retry sign out',
      }),
    ).toBeInTheDocument()
  })

  it('clears protected content and explains expiry on 401', async () => {
    session = student

    render(
      <MemoryRouter
        initialEntries={[
          '/student/dashboard',
        ]}
      >
        <AuthProvider>
          <LogoutButton />
          <ExpiryProbe />

          <AuthRoutes
            pendingPage={<h1>Pending</h1>}
          />
        </AuthProvider>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', {
      name: 'Student dashboard',
    })

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Protected request',
      }),
    )

    expect(
      await screen.findByText(
        'Your session expired. Please sign in again.',
      ),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('heading', {
        name: 'Student dashboard',
      }),
    ).not.toBeInTheDocument()
  })

  it('locks duplicate login submissions', async () => {
    const original =
      request.getMockImplementation()!

    let resolve!: (
      response: Response,
    ) => void

    request.mockImplementation(
      (input, options) =>
        input === '/api/auth/login'
          ? new Promise((done) => {
              resolve = done
            })
          : original(input, options),
    )

    mount()

    await userEvent.type(
      await screen.findByLabelText(
        'Email Address',
      ),
      student.email,
    )

    await userEvent.type(
      screen.getByLabelText('Password'),
      'test-password',
    )

    fireEvent.submit(
      screen.getByRole('form'),
    )

    fireEvent.submit(
      screen.getByRole('form'),
    )

    expect(
      screen.getByRole('button', {
        name: 'Signing in…',
      }),
    ).toBeDisabled()

    expect(
      request.mock.calls.filter(
        ([url]) =>
          url === '/api/auth/login',
      ),
    ).toHaveLength(1)

    await act(async () => {
      session = student

      resolve(
        new Response(null, {
          status: 204,
        }),
      )
    })

    await screen.findByRole('heading', {
      name: 'Student dashboard',
    })
  })

  it.each([403, 503, 'offline'])(
    'preserves session after protected failure %s',
    async (failure) => {
      session = student

      const original =
        request.getMockImplementation()!

      request.mockImplementation(
        (input, options) => {
          if (input !== '/api/private') {
            return original(
              input,
              options,
            )
          }

          if (failure === 'offline') {
            return Promise.reject(
              new TypeError('offline'),
            )
          }

          return Promise.resolve(
            new Response(null, {
              status: Number(failure),
            }),
          )
        },
      )

      render(
        <MemoryRouter
          initialEntries={[
            '/student/dashboard',
          ]}
        >
          <AuthProvider>
            <ExpiryProbe />

            <AuthRoutes
              pendingPage={
                <h1>Pending</h1>
              }
            />
          </AuthProvider>
        </MemoryRouter>,
      )

      await screen.findByRole(
        'heading',
        {
          name: 'Student dashboard',
        },
      )

      await userEvent.click(
        screen.getByRole('button', {
          name: 'Protected request',
        }),
      )

      expect(
        screen.getByRole('heading', {
          name: 'Student dashboard',
        }),
      ).toBeInTheDocument()
    },
  )

  it('ignores old session restoration after logout', async () => {
    let resolve!: (
      response: Response,
    ) => void

    request.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )

    function LogoutProbe() {
      const auth = useAuth()

      return (
        <>
          <p>
            State: {auth.status}
          </p>

          <button
            onClick={() => {
              void auth.signOut()
            }}
          >
            Logout now
          </button>
        </>
      )
    }

    render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    )

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Logout now',
      }),
    )

    await screen.findByText(
      'State: anonymous',
    )

    await act(async () => {
      resolve(Response.json(student))
    })

    expect(
      screen.getByText(
        'State: anonymous',
      ),
    ).toBeInTheDocument()
  })

  it('ignores a protected 401 from before a newer login', async () => {
    session = student

    const original =
      request.getMockImplementation()!

    let resolve!: (
      response: Response,
    ) => void

    request.mockImplementation(
      (input, options) =>
        input === '/api/private'
          ? new Promise((done) => {
              resolve = done
            })
          : original(input, options),
    )

    function Probe() {
      const auth = useAuth()

      return (
        <>
          <p>
            State: {auth.status}
          </p>

          <button
            onClick={() => {
              void auth.requestProtected(
                '/api/private',
              )
            }}
          >
            Old request
          </button>

          <button
            onClick={() => {
              void auth.signIn({
                email: student.email,
                password: 'test-password',
              })
            }}
          >
            New login
          </button>
        </>
      )
    }

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await screen.findByText(
      'State: authenticated',
    )

    await userEvent.click(
      screen.getByText('Old request'),
    )

    await userEvent.click(
      screen.getByText('New login'),
    )

    await waitFor(() => {
      expect(
        request.mock.calls.filter(
          ([url]) =>
            url === '/api/auth/me',
        ),
      ).toHaveLength(2)
    })

    await act(async () => {
      resolve(
        new Response(null, {
          status: 401,
        }),
      )
    })

    expect(
      screen.getByText(
        'State: authenticated',
      ),
    ).toBeInTheDocument()
  })

  it('serializes login before one deduplicated logout', async () => {
    const original =
      request.getMockImplementation()!

    let resolve!: (
      response: Response,
    ) => void

    request.mockImplementation(
      (input, options) =>
        input === '/api/auth/login'
          ? new Promise((done) => {
              resolve = done
            })
          : original(input, options),
    )

    function Probe() {
      const auth = useAuth()

      return (
        <>
          <p>
            State: {auth.status}
          </p>

          <button
            onClick={() => {
              void auth
                .signIn({
                  email: student.email,
                  password: 'test-password',
                })
                .catch(() => undefined)
            }}
          >
            Login now
          </button>

          <button
            onClick={() => {
              void auth.signOut()
            }}
          >
            Logout now
          </button>
        </>
      )
    }

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await screen.findByText(
      'State: anonymous',
    )

    await userEvent.click(
      screen.getByText('Login now'),
    )

    await userEvent.click(
      screen.getByText('Logout now'),
    )

    await userEvent.click(
      screen.getByText('Logout now'),
    )

    await userEvent.click(
      screen.getByText('Login now'),
    )

    expect(
      request.mock.calls.filter(
        ([url]) =>
          url === '/api/auth/login',
      ),
    ).toHaveLength(1)

    expect(
      request.mock.calls.filter(
        ([url]) =>
          url === '/api/auth/logout',
      ),
    ).toHaveLength(0)

    await act(async () => {
      session = student

      resolve(
        new Response(null, {
          status: 204,
        }),
      )
    })

    await screen.findByText(
      'State: anonymous',
    )

    expect(
      request.mock.calls.filter(
        ([url]) =>
          url === '/api/auth/logout',
      ),
    ).toHaveLength(1)

    expect(session).toBeNull()
  })
})