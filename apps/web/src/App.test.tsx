import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { apiRequest } from './api/client'

vi.mock('./api/client', () => ({ apiRequest: vi.fn() }))

beforeEach(() => {
  vi.mocked(apiRequest).mockReset().mockImplementation(async () => new Response(null, { status: 401 }))
})
afterEach(() => vi.unstubAllEnvs())

describe('merged registration and login routes', () => {
  it('keeps account selection at the root', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /I am a student/ })).toHaveAttribute('href', '/register/student')
    expect(screen.getByRole('link', { name: /I am an organizer/ })).toHaveAttribute('href', '/register/organizer')
  })

  it.each(['/register/student', '/register/organizer'])('opens login from %s', async (path) => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'Sign In' }))
    expect(screen.getByRole('heading', { name: 'Welcome back to Younity' })).toBeInTheDocument()
    expect(await screen.findByRole('form', { name: 'Sign in to Younity' })).toBeInTheDocument()
  })

  it('keeps production pending UI honest about unavailable application data', async () => {
    vi.stubEnv('DEV', false)
    vi.mocked(apiRequest).mockResolvedValue(Response.json({
      id: 1, email: 'organizer@example.test', role: 'ORGANIZER', status: 'PENDING',
      organization: { verificationStatus: 'PENDING' },
    }))
    render(<MemoryRouter initialEntries={['/organizer/pending']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Application status unavailable' })).toBeInTheDocument()
    expect(screen.queryByText(/YNT-ORG-2025/)).not.toBeInTheDocument()
  })
})
