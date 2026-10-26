import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  getSession,
  login,
  logout,
} from './service'
import { parseSessionUser } from './parseSessionUser'
import { getAuthDestination } from './getAuthDestination'

const student = {
  id: 'user-fixture',
  email: 'student@example.test',
  role: 'STUDENT',
  status: 'ACTIVE',
  organization: null,
}

describe('AUTH-05 session contract', () => {
  it('keeps only safe profile fields', () => {
    expect(
      parseSessionUser({
        ...student,
        accessToken: 'never-retain',
        passwordHash: 'never-retain',
      }),
    ).toEqual({
      id: student.id,
      email: student.email,
      role: 'STUDENT',
      userStatus: 'ACTIVE',
      organizationStatus: null,
    })
  })

  it.each([
    {},
    {
      id: 1,
      email: student.email,
    },
    {
      ...student,
      role: 'UNKNOWN',
    },
    {
      ...student,
      status: 'APPROVED',
    },
    {
      ...student,
      role: 'ORGANIZER',
    },
  ])(
    'rejects incompatible profiles: %j',
    (profile) => {
      expect(() => {
        parseSessionUser(profile)
      }).toThrow(
        expect.objectContaining({
          code: 'SERVICE_UNAVAILABLE',
        }),
      )
    },
  )

  it.each([
    [401, null],
    [403, 'ACCOUNT_UNAVAILABLE'],
    [404, 'SERVICE_UNAVAILABLE'],
    [500, 'SERVICE_UNAVAILABLE'],
  ])(
    'maps session HTTP %s',
    async (status, expected) => {
      const call = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(null, { status }),
        )

      if (expected === null) {
        expect(
          await getSession(call),
        ).toBeNull()
      } else {
        await expect(
          getSession(call),
        ).rejects.toMatchObject({
          code: expected,
        })
      }
    },
  )

  it('sends cookies and verifies the session after login', async () => {
    const call = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
        }),
      )
      .mockResolvedValueOnce(
        Response.json(student),
      )

    const credentials = {
      email: student.email,
      password: 'test-only',
    }

    const user = await login(
      credentials,
      call,
    )

    expect(user.email).toBe(student.email)

    expect(call).toHaveBeenNthCalledWith(
      1,
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(credentials),
      }),
    )

    expect(call).toHaveBeenNthCalledWith(
      2,
      '/api/auth/me',
      expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
      }),
    )
  })

  it('rejects successful login without a session', async () => {
    const call = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 401,
        }),
      )

    await expect(
      login(
        {
          email: student.email,
          password: 'test-only',
        },
        call,
      ),
    ).rejects.toMatchObject({
      code: 'SESSION_NOT_ESTABLISHED',
    })
  })

  it.each([401, 403, 503])(
    'maps login failure %s',
    async (status) => {
      const call = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(null, {
            status,
          }),
        )

      await expect(
        login(
          {
            email: student.email,
            password: 'test-only',
          },
          call,
        ),
      ).rejects.toMatchObject({
        code:
          status === 401
            ? 'INVALID_CREDENTIALS'
            : status === 403
              ? 'ACCOUNT_UNAVAILABLE'
              : 'SERVICE_UNAVAILABLE',
      })

      expect(call).toHaveBeenCalledTimes(1)
    },
  )

  it('distinguishes network failure', async () => {
    const call = vi
      .fn()
      .mockRejectedValue(
        new TypeError('offline'),
      )

    await expect(
      getSession(call),
    ).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
  })

  it.each([200, 204, 401])(
    'confirms logout HTTP %s',
    async (status) => {
      const call = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(null, {
            status,
          }),
        )
        .mockResolvedValueOnce(
          new Response(null, {
            status: 401,
          }),
        )

      await expect(
        logout(call),
      ).resolves.toBeUndefined()

      expect(call).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      )
    },
  )

  it('rejects logout if the session remains active', async () => {
    const call = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
        }),
      )
      .mockResolvedValueOnce(
        Response.json(student),
      )

    await expect(
      logout(call),
    ).rejects.toMatchObject({
      code: 'SESSION_STILL_ACTIVE',
    })
  })

  it('rejects an unavailable logout confirmation', async () => {
    const call = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 503,
        }),
      )

    await expect(
      logout(call),
    ).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    })
  })
})

describe('AUTH-05 role/status destinations', () => {
  it.each([
    [
      'STUDENT',
      'ACTIVE',
      null,
      '/student/dashboard',
    ],
    [
      'STUDENT',
      'SUSPENDED',
      null,
      null,
    ],
    [
      'STUDENT',
      'PENDING',
      null,
      null,
    ],
    [
      'ORGANIZER',
      'ACTIVE',
      'APPROVED',
      '/organizer/dashboard',
    ],
    [
      'ORGANIZER',
      'PENDING',
      'PENDING',
      '/organizer/pending',
    ],
    [
      'ORGANIZER',
      'ACTIVE',
      'PENDING',
      '/organizer/pending',
    ],
    [
      'ORGANIZER',
      'ACTIVE',
      'NEEDS_CHANGES',
      '/organizer/status',
    ],
    [
      'ORGANIZER',
      'ACTIVE',
      'REJECTED',
      '/organizer/status',
    ],
    [
      'ORGANIZER',
      'SUSPENDED',
      'APPROVED',
      null,
    ],
    [
      'ADMIN',
      'ACTIVE',
      null,
      null,
    ],
  ] as const)(
    'routes %s / %s / %s',
    (
      role,
      userStatus,
      organizationStatus,
      expected,
    ) => {
      expect(
        getAuthDestination({
          role,
          userStatus,
          organizationStatus,
        }),
      ).toBe(expected)
    },
  )
})