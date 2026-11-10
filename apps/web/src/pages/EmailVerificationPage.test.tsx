import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmailVerificationPage from './EmailVerificationPage'
import { apiRequest } from '../api/client'
import { rememberVerification, VERIFICATION_RESEND_SECONDS } from '../auth/emailVerification'
import LoginForm from '../components/LoginForm'
import { LoginError } from '../auth/model'

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }))
const request = vi.mocked(apiRequest)
const token = 'a'.repeat(64)
const email = 'student@example.test'
function mount(query = '') {
  return render(<StrictMode><MemoryRouter initialEntries={[`/verify-email${query}`]}><EmailVerificationPage /></MemoryRouter></StrictMode>)
}
beforeEach(() => { request.mockReset(); sessionStorage.clear() })
afterEach(() => vi.useRealTimers())

describe('email verification page', () => {
  it('links an unverified sign-in to email-only recovery and clears the login password', async () => {
    render(<MemoryRouter><LoginForm onSubmit={async () => { throw new LoginError('EMAIL_NOT_VERIFIED') }} /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText('Email Address'), email)
    await userEvent.type(screen.getByLabelText('Password'), 'Password-2026!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In to Younity' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Verify your email before signing in')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    const link = screen.getByRole('link', { name: 'Resend verification email' })
    expect(link).toHaveAttribute('href', '/verify-email')
    await userEvent.click(link)
    expect(JSON.parse(sessionStorage.getItem('younity.emailVerification')!)).toEqual({ email, resendAvailableAt: 0, deliveryFailed: false })
  })

  it('requires confirmation before consuming a link, including under StrictMode', async () => {
    request.mockResolvedValue(Response.json({ message: 'Email verified successfully.' }))
    mount(`?token=${token}`)
    expect(request).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeVisible()
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/email-verification/verify-email', expect.objectContaining({ method: 'POST', body: JSON.stringify({ token }) }))
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login')
  })

  it('handles malformed links without sending a request', () => {
    mount('?token=bad')
    expect(screen.getByRole('alert')).toHaveTextContent('This link is no longer valid')
    expect(screen.queryByRole('button', { name: 'Verify email' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request a new link' })).toBeVisible()
    expect(request).not.toHaveBeenCalled()
  })

  it('recovers expired/used links on another device by asking only for the email', async () => {
    request.mockResolvedValueOnce(Response.json({ message: 'Verification link is invalid, expired, or already used.' }, { status: 400 })).mockResolvedValueOnce(Response.json({}))
    mount(`?token=${token}`)
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This link is no longer valid')
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Request a new link' }))
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Email address'), email)
    await userEvent.click(screen.getByRole('button', { name: 'Request a new link' }))
    expect(request).toHaveBeenLastCalledWith('/api/auth/resend-verification', expect.objectContaining({ body: JSON.stringify({ email }) }))
    expect(screen.getByText(/If this address belongs/)).toBeVisible()
  })

  it('resends an invalid link in one click when the address is already known', async () => {
    rememberVerification({ email, resendAvailableAt: 0, deliveryFailed: false })
    request.mockResolvedValueOnce(new Response(null, { status: 400 })).mockResolvedValueOnce(Response.json({}))
    mount(`?token=${token}`)
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Request a new link' }))
    expect(request).toHaveBeenLastCalledWith('/api/auth/resend-verification', expect.objectContaining({ body: JSON.stringify({ email }) }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('masks the registration address and shows resend only after 60 seconds, including after reload', () => {
    vi.useFakeTimers()
    rememberVerification({ email, resendAvailableAt: Date.now() + VERIFICATION_RESEND_SECONDS * 1000, deliveryFailed: false })
    const view = mount()
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    expect(screen.getByText('s***@example.test')).toBeVisible()
    expect(screen.queryByText(email)).not.toBeInTheDocument()
    expect(screen.getByText(/expire after 10 minutes/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Resend email' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(59000))
    view.unmount(); mount()
    expect(screen.queryByRole('button', { name: 'Resend email' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.getByText('Didn’t receive it?')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeVisible()
  })

  it('offers an immediate email-only retry after registration delivery failure', async () => {
    rememberVerification({ email, resendAvailableAt: 0, deliveryFailed: true })
    request.mockResolvedValue(Response.json({}))
    mount()
    expect(screen.getByText(/account was created, but we could not send/)).toBeVisible()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry sending' }))
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/auth/resend-verification', expect.objectContaining({ body: JSON.stringify({ email }) }))
    expect(screen.getByText(/If this address belongs/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry sending' })).not.toBeInTheDocument()
    expect(sessionStorage.getItem('younity.emailVerification')).not.toContain('password')
  })

  it.each([429, 503])('shows a request failure (%s) and keeps resend retry available', async (status) => {
    request.mockResolvedValue(Response.json({}, { status }))
    mount('?email=student%40example.test')
    await userEvent.click(screen.getByRole('button', { name: 'Resend email' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 429 ? 'Too many requests' : 'We could not complete your request')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled()
  })

  it('prevents duplicate verification requests while waiting for a response', async () => {
    let resolve!: (value: Response) => void
    request.mockImplementation(() => new Promise((done) => { resolve = done }))
    mount(`?token=${token}`)
    const button = screen.getByRole('button', { name: 'Verify email' })
    fireEvent.click(button); fireEvent.click(button)
    expect(request).toHaveBeenCalledTimes(1)
    await act(async () => resolve(Response.json({})))
    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeVisible()
  })

  it('prevents duplicate resends and starts a fresh 60-second wait after a generic response', async () => {
    vi.useFakeTimers()
    let resolve!: (value: Response) => void
    request.mockImplementation(() => new Promise((done) => { resolve = done }))
    mount('?email=student%40example.test')
    const button = screen.getByRole('button', { name: 'Resend email' })
    fireEvent.click(button); fireEvent.click(button)
    expect(request).toHaveBeenCalledTimes(1)
    await act(async () => resolve(Response.json({})))
    expect(screen.queryByRole('button', { name: 'Resend email' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(60000))
    expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled()
  })

  it('offers retry when the network fails', async () => {
    request.mockRejectedValue(new TypeError('Failed to fetch'))
    mount(`?token=${token}`)
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Verify email' })).toBeEnabled())
  })
})
