import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import AuthProvider, { type AuthService } from './AuthProvider'
import RequireAuth from './RequireAuth'
import { useAuth } from './useAuth'
import LoginPage from '../pages/LoginPage'
import { getSession, login, logout } from './service'

const user = { id: 1, email: 'user@example.test' }
function service(overrides: Partial<AuthService> = {}): AuthService {
  return { getSession: vi.fn().mockResolvedValue(user), login: vi.fn().mockResolvedValue(user), logout: vi.fn().mockResolvedValue(undefined), ...overrides }
}
function mount(adapter: AuthService) {
  return render(<MemoryRouter initialEntries={['/organizer/pending?source=login']}><AuthProvider service={adapter}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<RequireAuth />}><Route path="/organizer/pending" element={<h1>Protected pending</h1>} /></Route>
  </Routes></AuthProvider></MemoryRouter>)
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('auth provider and guarded pending route', () => {
  it('hides pending while restoring the session, then admits a signed-in user', async () => {
    const session = deferred<typeof user>()
    mount(service({ getSession: () => session.promise }))
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
    expect(screen.queryByText('Protected pending')).not.toBeInTheDocument()
    session.resolve(user)
    expect(await screen.findByText('Protected pending')).toBeInTheDocument()
  })
  it('redirects an anonymous user to login and returns to pending after login', async () => {
    const adapter = service({ getSession: vi.fn().mockResolvedValue(null) })
    mount(adapter)
    const interaction = userEvent.setup()
    await interaction.type(await screen.findByLabelText('Email Address'), user.email)
    await interaction.type(screen.getByLabelText('Password'), 'secret')
    await interaction.click(screen.getByRole('button', { name: 'Sign In to Younity' }))
    expect(await screen.findByText('Protected pending')).toBeInTheDocument()
    expect(adapter.login).toHaveBeenCalledWith({ email: user.email, password: 'secret' })
  })
  it('blocks pending on session errors and permits a successful retry', async () => {
    const adapter = service({ getSession: vi.fn().mockRejectedValueOnce(new Error()).mockResolvedValue(user) })
    mount(adapter)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not check your session')
    expect(screen.queryByText('Protected pending')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry session check' }))
    expect(await screen.findByText('Protected pending')).toBeInTheDocument()
  })
  it('signs out through the server and removes protected content', async () => {
    const adapter = service()
    mount(adapter)
    await screen.findByText('Protected pending')
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('form')).toBeInTheDocument()
    expect(screen.queryByText('Protected pending')).not.toBeInTheDocument()
    expect(adapter.logout).toHaveBeenCalledTimes(1)
  })
  it('does not claim successful logout when the server fails', async () => {
    mount(service({ logout: vi.fn().mockRejectedValue(new Error()) }))
    await screen.findByText('Protected pending')
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not sign you out')
    expect(screen.queryByText('Protected pending')).not.toBeInTheDocument()
  })
  it('ignores an older session response after logout', async () => {
    const oldSession = deferred<typeof user>()
    function Probe() {
      const auth = useAuth()
      return <><p>{auth.status}</p><button onClick={() => void auth.signOut()}>Logout now</button></>
    }
    render(<AuthProvider service={service({ getSession: () => oldSession.promise })}><Probe /></AuthProvider>)
    await userEvent.click(screen.getByText('Logout now'))
    await screen.findByText('anonymous')
    await act(async () => { oldSession.resolve(user); await oldSession.promise })
    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())
  })
})

describe('auth HTTP adapter', () => {
  it('restores anonymous sessions on 401 but fails closed on malformed success', async () => {
    expect(await getSession(vi.fn().mockResolvedValue(new Response(null, { status: 401 })))).toBeNull()
    await expect(getSession(vi.fn().mockResolvedValue(Response.json({})))).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
  })
  it('checks the session after login instead of trusting the login response', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(Response.json(user))
    expect(await login({ email: user.email, password: 'secret' }, request)).toEqual(user)
    expect(request).toHaveBeenLastCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'include', cache: 'no-store' }))
  })
  it('rejects invalid credentials without requesting a session', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    await expect(login({ email: user.email, password: 'secret' }, request)).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(request).toHaveBeenCalledTimes(1)
  })
  it('posts cookie-based logout and propagates server failures', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    await logout(request)
    expect(request).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST', credentials: 'include' })
    await expect(logout(vi.fn().mockResolvedValue(new Response(null, { status: 500 })))).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
  })
})
