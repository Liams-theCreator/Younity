import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmailVerificationPage from './EmailVerificationPage'
import { apiRequest } from '../api/client'
import { rememberVerification, type VerificationContext } from '../auth/emailVerification'
import LoginForm from '../components/LoginForm'
import { LoginError } from '../auth/model'

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }))
const request = vi.mocked(apiRequest)
const token = 'a'.repeat(64)
const email = 'student@example.test'
const message = 'If this address belongs to an account awaiting verification, check your inbox.'
function mount(query = '', context?: VerificationContext) {
  return render(<StrictMode><MemoryRouter initialEntries={[{ pathname: '/verify-email', search: query, state: context ? { verification: context } : null }]}><EmailVerificationPage /></MemoryRouter></StrictMode>)
}
function posts(path: string) { return request.mock.calls.filter(([input]) => input === path) }
beforeEach(() => { request.mockReset(); sessionStorage.clear() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('email verification page', () => {
  it('submits the corrected visible address only when Send is clicked', async () => {
    request.mockImplementation(async () => Response.json({ message }))
    mount()
    const input = screen.getByLabelText('Enter the email you registered with.')
    await userEvent.type(input, 'typo@example.test')
    expect(request).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Send verification email' }))
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({ email: 'typo@example.test' })
    expect(screen.getByRole('status')).toHaveTextContent(message)
    expect(input).toBeEnabled()
    await userEvent.clear(input)
    await userEvent.type(input, email)
    expect(request).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Send verification email' }))
    expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toEqual({ email })
    expect(screen.getByRole('status')).toHaveTextContent(message)
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Email verified' })).not.toBeInTheDocument()
  })

  it('keeps public recovery separate from a prior registration capability and its private deadline', async () => {
    const context = rememberVerification({ email, recoveryToken: 'private-registration-capability', resendAvailableAt: Date.now() + 600000, deliveryFailed: false })
    request.mockImplementation(async () => Response.json({ message }))
    mount('?recover=1', context)
    const input = screen.getByLabelText('Enter the email you registered with.')
    await userEvent.clear(input); await userEvent.type(input, 'another@example.test')
    expect(request).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Send verification email' }))
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/auth/resend-verification', expect.objectContaining({ body: JSON.stringify({ email: 'another@example.test' }) }))
    expect(JSON.parse(sessionStorage.getItem('younity.emailVerification')!).email).toBe(email)
    expect(screen.queryByText(/current link expires/)).not.toBeInTheDocument()
  })

  it('links an unverified sign-in to email-only recovery and clears the login password', async () => {
    render(<MemoryRouter><LoginForm onSubmit={async () => { throw new LoginError('EMAIL_NOT_VERIFIED') }} /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText('Email Address'), email)
    await userEvent.type(screen.getByLabelText('Password'), 'Password-2026!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In to Younity' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Verify your email before signing in')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    const link = screen.getByRole('link', { name: 'Resend verification email' })
    await userEvent.click(link)
    expect(JSON.parse(sessionStorage.getItem('younity.emailVerification')!)).toMatchObject({ email, resendAvailableAt: 0, deliveryFailed: false, flowId: expect.any(String) })
  })

  it('verifies only on confirmation and prevents duplicate submissions under StrictMode', async () => {
    let resolve!: (value: Response) => void
    request.mockImplementation(() => new Promise((done) => { resolve = done }))
    mount(`?token=${token}`)
    expect(request).not.toHaveBeenCalled()
    const button = screen.getByRole('button', { name: 'Verify email' })
    fireEvent.click(button); fireEvent.click(button)
    expect(request).toHaveBeenCalledTimes(1)
    await act(async () => resolve(Response.json({ message: 'Email verified successfully.' })))
    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeVisible()
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/email-verification/verify-email', expect.objectContaining({ method: 'POST', body: JSON.stringify({ token }) }))
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('heading', { name: 'Check your email' })).not.toBeInTheDocument()
  })

  it('handles malformed links without sending a request and offers the editable public form', () => {
    mount('?token=bad')
    expect(screen.getByRole('alert')).toHaveTextContent('This link is no longer valid')
    expect(screen.queryByRole('button', { name: 'Verify email' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Enter the email you registered with.')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Send verification email' })).toBeVisible()
    expect(request).not.toHaveBeenCalled()
  })

  it('recovers expired/used links on another device by asking only for the email', async () => {
    request.mockResolvedValueOnce(new Response(null, { status: 400 })).mockResolvedValueOnce(Response.json({ message }))
    mount(`?token=${token}`)
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This link is no longer valid')
    await userEvent.type(screen.getByLabelText('Enter the email you registered with.'), email)
    await userEvent.click(screen.getByRole('button', { name: 'Send verification email' }))
    expect(request).toHaveBeenLastCalledWith('/api/auth/resend-verification', expect.objectContaining({ body: JSON.stringify({ email }) }))
    expect(screen.getByRole('status')).toHaveTextContent(message)
    expect(screen.getByLabelText('Enter the email you registered with.')).toHaveValue(email)
  })

  it('uses the backend deadline through refresh and checks account state at expiry without waiting ten real minutes', async () => {
    vi.useFakeTimers()
    const deadline = Date.now() + 600000
    const context = rememberVerification({ email, recoveryToken: 'scoped', resendAvailableAt: deadline, deliveryFailed: false })
    request.mockImplementation(async (path) => Response.json({ verified: false, unavailable: false,
      expiresAt: path === '/api/email-verification/retry' ? new Date(Date.now() + 600000).toISOString() : Date.now() < deadline ? new Date(deadline).toISOString() : null }))
    let view = mount('', context)
    await act(async () => {})
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    expect(screen.getByText('s***@example.test')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeVisible()
    await act(async () => vi.advanceTimersByTime(60000))
    expect(screen.queryByRole('button', { name: 'Resend verification email' })).not.toBeInTheDocument()
    view.unmount(); view = mount('', context)
    await act(async () => {})
    expect(JSON.parse(sessionStorage.getItem('younity.emailVerification')!).resendAvailableAt).toBe(deadline)
    await act(async () => vi.advanceTimersByTime(539999))
    expect(screen.queryByRole('button', { name: 'Resend verification email' })).not.toBeInTheDocument()
    await act(async () => vi.advanceTimersByTime(1))
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Email verified' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Resend verification email' })))
    expect(posts('/api/email-verification/retry')).toHaveLength(1)
    expect(JSON.parse(String(posts('/api/email-verification/retry')[0][1]?.body))).toEqual({ recoveryToken: 'scoped' })
    expect(posts('/api/auth/resend-verification')).toHaveLength(0)
    expect(screen.getByText('s***@example.test')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Resend verification email' })).not.toBeInTheDocument()
    view.unmount()
  })

  it('keeps an expired registration session on the waiting page without an email form or link to one', async () => {
    const context = rememberVerification({ email, recoveryToken: 'expired-session', resendAvailableAt: 0, deliveryFailed: false })
    request.mockResolvedValue(new Response(null, { status: 401 }))
    mount('', context)
    expect(await screen.findByRole('status')).toHaveTextContent('This verification session expired.')
    expect(screen.getByText('s***@example.test')).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit.*email/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/login', '/login'])
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeVisible()
  })

  it('does not offer resend at expiry when verification completed in another tab', async () => {
    vi.useFakeTimers()
    const deadline = Date.now() + 600000
    const context = rememberVerification({ email, recoveryToken: 'scoped', resendAvailableAt: deadline, deliveryFailed: false })
    request.mockImplementation(async () => Response.json({ verified: Date.now() >= deadline, unavailable: false, expiresAt: Date.now() < deadline ? new Date(deadline).toISOString() : null }))
    mount('', context)
    await act(async () => {})
    await act(async () => vi.advanceTimersByTime(600000))
    expect(screen.getByRole('heading', { name: 'Email verified' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Resend verification email' })).not.toBeInTheDocument()
    expect(posts('/api/email-verification/retry')).toHaveLength(0)
  })

  it('offers retry when the verification network request fails', async () => {
    request.mockRejectedValue(new TypeError('Failed to fetch'))
    mount(`?token=${token}`)
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Verify email' })).toBeEnabled())
  })
})
