import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { apiRequest } from '../api/client'

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }))
const request = vi.mocked(apiRequest)
const email = 'verification-integration@example.test'
const token = 'a'.repeat(64)
const unverified = () => Response.json({ code: 'EMAIL_NOT_VERIFIED' }, { status: 403 })

function OpenEmailLink() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(`/verify-email?token=${token}`)}>Open test email link</button>
}

function mount(path = '/login') {
  render(<MemoryRouter initialEntries={[path]}><App /><OpenEmailLink /></MemoryRouter>)
}

beforeEach(() => {
  request.mockReset()
  sessionStorage.clear()
})

describe('verification integration with shared authentication', () => {
  it('recovers an unverified session on reload without presenting a service outage', async () => {
    request.mockResolvedValue(unverified())
    mount('/student/preferences')

    expect(await screen.findByText('Verify your email before signing in.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Resend verification email' })).toHaveAttribute('href', '/verify-email')
    expect(screen.queryByText('We could not check your session. Please try again.')).not.toBeInTheDocument()
    expect(request.mock.calls.some(([url]) => url === '/api/student/preferences')).toBe(false)

    await userEvent.click(screen.getByRole('link', { name: 'Resend verification email' }))
    expect(await screen.findByRole('heading', { name: 'Request a verification email' })).toBeVisible()
  })

  it.each(['STUDENT', 'ORGANIZER'] as const)('verifies then signs in a %s without treating verification as login or approval', async (role) => {
    let verified = false
    let signedIn = false
    request.mockImplementation(async (url) => {
      if (url === '/api/auth/me') {
        return signedIn ? Response.json({
          id: 'verified-user', email, role,
          status: role === 'STUDENT' ? 'ACTIVE' : 'PENDING',
          organization: role === 'STUDENT' ? null : { verificationStatus: 'PENDING' },
        }) : new Response(null, { status: 401 })
      }
      if (url === '/api/auth/login') {
        if (!verified) return unverified()
        signedIn = true
        return Response.json({})
      }
      if (url === '/api/email-verification/verify-email') {
        verified = true
        return Response.json({ message: 'Email verified successfully.' })
      }
      throw new Error(`Unexpected request: ${String(url)}`)
    })

    mount()
    await userEvent.type(await screen.findByLabelText('Email Address'), email)
    await userEvent.type(screen.getByLabelText('Password'), 'Example-password-2026!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In to Younity' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Verify your email')
    expect(screen.getByLabelText('Password')).toHaveValue('')

    await userEvent.click(screen.getByRole('link', { name: 'Resend verification email' }))
    expect(await screen.findByRole('heading', { name: 'Request a verification email' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Open test email link' }))
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }))
    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeVisible()
    expect(signedIn).toBe(false)

    await userEvent.click(screen.getByRole('link', { name: 'Go to sign in' }))
    await userEvent.type(await screen.findByLabelText('Email Address'), email)
    await userEvent.type(screen.getByLabelText('Password'), 'Example-password-2026!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In to Younity' }))
    expect(await screen.findByRole('heading', {
      name: role === 'STUDENT' ? 'Student dashboard' : 'Organization verification pending',
    })).toBeVisible()
  })

  it('registers without academic fields and keeps recovery context without credentials', async () => {
    const expiresAt = new Date(Date.now() + 600000).toISOString()
    request.mockImplementation(async (url) => {
      if (url === '/api/auth/me') return new Response(null, { status: 401 })
      if (url === '/api/email-verification/recovery-status') return Response.json({ verified: false, unavailable: false, expiresAt })
      if (url === '/api/auth/register/student') return Response.json({ id: 'new-student', email, verificationEmailSent: true, verificationExpiresAt: expiresAt, verificationRecoveryToken: 'test-recovery' }, { status: 201 })
      throw new Error(`Unexpected request: ${String(url)}`)
    })
    mount('/register/student')
    for (const [label, value] of [['First Name', 'Sara'], ['Last Name', 'Test'], ['Email Address', email], ['Account Password', 'Example-password-2026!'], ['Confirm password', 'Example-password-2026!']]) {
      fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } })
    }
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Create student account' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible()
    const registration = request.mock.calls.find(([url]) => url === '/api/auth/register/student')!
    expect(JSON.parse(String(registration[1]?.body))).not.toHaveProperty('university')
    expect(request.mock.calls.some(([url]) => url === '/api/auth/login')).toBe(false)
    expect(JSON.parse(sessionStorage.getItem('younity.emailVerification')!)).toEqual({
      email, deliveryFailed: false, resendAvailableAt: Date.parse(expiresAt),
      flowId: expect.any(String), recoveryToken: 'test-recovery',
    })
  })
})